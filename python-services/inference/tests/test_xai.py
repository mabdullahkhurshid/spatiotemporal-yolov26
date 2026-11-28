import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np

from app.xai.layercam import focus_in_box
from app.xai.risk import FEATURE_NAMES, MISSING, alert_features, risk_level
from app.xai.train_risk import build_dataset, label_of

ROOT = Path(__file__).resolve().parents[1]
PT = ROOT / "weights" / "best.pt"
ONNX = ROOT / "weights" / "best.onnx"
CLASSES = ROOT / "config" / "classes.json"
VIDEO = ROOT.parents[1] / "demo_videos" / "video.mp4"

HAS_TORCH = all(importlib.util.find_spec(m) for m in ("torch", "ultralytics"))
HAS_SHAP = importlib.util.find_spec("shap") is not None


class FocusTests(unittest.TestCase):
    def test_focus_is_share_of_attention_inside_box(self):
        cam = np.zeros((10, 10), dtype=np.float32)
        cam[2:4, 2:4] = 1.0
        cam[8, 8] = 4.0
        self.assertAlmostEqual(focus_in_box(cam, (2, 2, 4, 4)), 0.5)
        self.assertEqual(focus_in_box(np.zeros((4, 4)), (0, 0, 2, 2)), 0.0)


def job(**overrides):
    base = {
        "timestamp": "2026-10-19T18:30:00.000Z",
        "fireConfidence": 80,
        "smokeConfidence": 40,
        "boundingBoxes": [
            {"className": "fire", "confidence": 80, "x": 0.1, "y": 0.2, "w": 0.2, "h": 0.2, "scores": {"fire": 80, "other": 30, "smoke": 2}},
            {"className": "smoke", "confidence": 40, "x": 0.0, "y": 0.0, "w": 0.1, "h": 0.1},
            {"className": "other", "confidence": 99, "x": 0.5, "y": 0.5, "w": 0.5, "h": 0.5},
        ],
        "metricsSnapshot": {"estimatedSpreadRate": 0.002, "detectionFrequencyPerMin": 12},
        "decision": {"coverage": 0.05, "streakMeanConfidence": 75},
    }
    base.update(overrides)
    return base


class RiskFeatureTests(unittest.TestCase):
    def test_features_from_a_claim_job(self):
        row = alert_features(job(), {"closed": 8, "falseAlarms": 6}, focus=0.9)
        self.assertEqual(list(row), FEATURE_NAMES)
        self.assertEqual(row["box_count"], 2.0)  # "other" boxes are ignored
        self.assertEqual(row["both_classes"], 1.0)
        self.assertAlmostEqual(row["other_score"], 0.30)
        self.assertAlmostEqual(row["largest_box"], 0.04)
        self.assertAlmostEqual(row["box_center_y"], 0.3)
        self.assertAlmostEqual(row["streak_mean"], 0.75)
        self.assertAlmostEqual(row["camera_fa_rate"], 7 / 10)
        self.assertAlmostEqual(row["focus_in_box"], 0.9)
        self.assertAlmostEqual(row["hour_sin"], np.sin(2 * np.pi * 18.5 / 24))

    def test_missing_inputs_use_neutral_values(self):
        row = alert_features({"fireConfidence": 50})
        self.assertEqual(row["focus_in_box"], MISSING)
        self.assertEqual(row["camera_fa_rate"], 0.5)
        self.assertEqual(row["box_count"], 0.0)
        self.assertAlmostEqual(row["streak_mean"], 0.5)

    def test_focus_is_read_from_a_training_export(self):
        exported = {"explanation": {"decision": {}, "visual": {"targets": [{"focusInBox": 0.3}, {"focusInBox": 0.7}]}}}
        self.assertAlmostEqual(alert_features(exported)["focus_in_box"], 0.7)

    def test_risk_bands(self):
        self.assertEqual(risk_level(0.1), "low")
        self.assertEqual(risk_level(0.3), "medium")
        self.assertEqual(risk_level(0.75), "high")


def exported_alert(i, when, status, resolution=None, camera="cam-a", other=5):
    return {
        "_id": str(i),
        "cameraId": camera,
        "timestamp": when.isoformat(),
        "resolvedAt": (when + timedelta(minutes=5)).isoformat(),
        "status": status,
        "resolutionType": resolution,
        "fireConfidence": 70,
        "smokeConfidence": 0,
        "boundingBoxes": [{"className": "fire", "confidence": 70, "x": 0.1, "y": 0.1, "w": 0.1, "h": 0.1, "scores": {"other": other}}],
        "metricsSnapshot": {},
        "explanation": {"decision": {"coverage": 0.01}},
    }


class TrainingDataTests(unittest.TestCase):
    def test_labels(self):
        self.assertEqual(label_of({"status": "false_alarm"}), 1)
        self.assertEqual(label_of({"status": "resolved", "resolutionType": "EXTINGUISHED"}), 0)
        self.assertIsNone(label_of({"status": "resolved", "resolutionType": "TEST_DRILL"}))
        self.assertIsNone(label_of({"status": "active"}))

    def test_training_refuses_to_write_a_model_without_enough_labels(self):
        from unittest import mock

        from app.xai import train_risk

        t0 = datetime(2026, 10, 1, tzinfo=timezone.utc)
        few = [exported_alert(i, t0 + timedelta(hours=i), "false_alarm") for i in range(5)]
        client = mock.Mock(fetch_training_data=mock.Mock(return_value=few))
        with mock.patch("app.backend_client.BackendClient", return_value=client), mock.patch("joblib.dump") as dump:
            self.assertEqual(train_risk.main(["--out", "unused.joblib"]), 2)
        dump.assert_not_called()

    def test_camera_history_has_no_look_ahead(self):
        t0 = datetime(2026, 10, 1, tzinfo=timezone.utc)
        alerts = [
            exported_alert(1, t0, "false_alarm"),
            exported_alert(2, t0 + timedelta(hours=1), "false_alarm"),
            exported_alert(3, t0 + timedelta(hours=2), "resolved", "EXTINGUISHED"),
            exported_alert(4, t0 + timedelta(hours=3), "resolved", "TEST_DRILL"),  # unlabelled, still history
            exported_alert(5, t0 + timedelta(hours=4), "resolved", "EVACUATED", camera="cam-b"),
        ]
        x, y = build_dataset(alerts)
        self.assertEqual(y.tolist(), [1, 1, 0, 0])
        closed = x[:, FEATURE_NAMES.index("camera_closed")]
        # Alert 1 had no history, alert 2 saw alert 1, alert 3 saw alerts 1–2; cam-b starts fresh.
        np.testing.assert_allclose(np.expm1(closed), [0, 1, 2, 0], atol=1e-9)
        rate = x[:, FEATURE_NAMES.index("camera_fa_rate")]
        np.testing.assert_allclose(rate, [1 / 2, 2 / 3, 3 / 4, 1 / 2])


@unittest.skipUnless(HAS_SHAP, "shap not installed")
class RiskModelTests(unittest.TestCase):
    def test_trained_model_scores_and_explains_with_shap(self):
        from app.xai.risk import RiskScorer
        from app.xai.train_risk import make_artifact, train

        rng = np.random.default_rng(1)
        t0 = datetime(2026, 9, 1, tzinfo=timezone.utc)
        alerts = []
        for i in range(240):
            false_alarm = rng.random() < 0.4
            # Synthetic signal: false alarms have a high "other" score on the main box.
            other = rng.uniform(40, 90) if false_alarm else rng.uniform(0, 30)
            status, resolution = ("false_alarm", None) if false_alarm else ("resolved", "EXTINGUISHED")
            alerts.append(exported_alert(i, t0 + timedelta(minutes=30 * i), status, resolution, camera=f"cam-{i % 4}", other=other))
        x, y = build_dataset(alerts)
        model, metrics = train(x, y)
        self.assertGreater(metrics["rocAuc"], 0.9)
        scorer = RiskScorer(make_artifact(model, metrics, x))

        risky = scorer.score(alert_features(job(boundingBoxes=[{**job()["boundingBoxes"][0], "scores": {"other": 85}}])))
        safe = scorer.score(alert_features(job(boundingBoxes=[{**job()["boundingBoxes"][0], "scores": {"other": 2}}])))
        self.assertGreater(risky["probability"], safe["probability"])
        self.assertIn(risky["level"], ("low", "medium", "high"))
        self.assertEqual(len(risky["contributions"]), 3)
        top = risky["contributions"][0]
        self.assertEqual(top["feature"], "other_score")
        self.assertGreater(top["impact"], 0)
        self.assertIn("85%", top["label"])
        features = [c["feature"] for c in risky["contributions"]]
        self.assertNotIn("hour_sin", features)

    def test_explainer_retrains_on_schedule_reloads_and_reports_status(self):
        import tempfile
        from unittest import mock

        from app.xai.main import Explainer
        from app.xai.risk import model_status

        rng = np.random.default_rng(2)
        t0 = datetime(2026, 9, 1, tzinfo=timezone.utc)
        alerts = []
        for i in range(200):
            fa = rng.random() < 0.4
            alerts.append(
                exported_alert(i, t0 + timedelta(hours=i), "false_alarm" if fa else "resolved", None if fa else "EXTINGUISHED", other=80 if fa else 5)
            )
        reported = []
        client = SimpleNamespace(fetch_training_data=lambda: alerts, report_model_status=reported.append)

        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "risk_model.joblib")
            self.assertEqual(model_status(path), {"active": False, "lastResult": "loaded"})
            with mock.patch.multiple("app.xai.main.settings", xai_risk_model_path=path, xai_retrain_hours=24, xai_min_samples=150, xai_min_per_class=30):
                explainer = Explainer.__new__(Explainer)
                explainer.client = client
                explainer.risk = None
                explainer._risk_mtime = None
                explainer._next_training = 0.0
                explainer.retrain_if_due()
                self.assertIsNotNone(explainer.risk, "model should be trained and loaded")
                self.assertEqual(len(reported), 1)
                self.assertTrue(reported[0]["active"])
                self.assertEqual(reported[0]["lastResult"], "trained")
                self.assertEqual(reported[0]["version"], explainer.risk.version)
                self.assertEqual(reported[0]["metrics"]["samples"], 200)
                # Not due again for 24 h.
                explainer.retrain_if_due()
                self.assertEqual(len(reported), 1)

    def test_too_few_labels_keeps_learning_status(self):
        import tempfile

        from app.xai.risk import model_status
        from app.xai.train_risk import attempt_training

        client = SimpleNamespace(fetch_training_data=lambda: [exported_alert(1, datetime(2026, 9, 1, tzinfo=timezone.utc), "false_alarm")])
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "risk_model.joblib")
            outcome = attempt_training(client, path)
            status = model_status(path, outcome)
        self.assertEqual(status["lastResult"], "not_enough_labels")
        self.assertFalse(status["active"])
        self.assertIn("1 labelled", status["message"])
        self.assertEqual(status["requirements"]["minSamples"], 150)

    def test_feature_set_mismatch_is_rejected(self):
        from app.xai.risk import RiskScorer

        with self.assertRaises(ValueError):
            RiskScorer({"features": ["fire_conf"], "model": None, "background": np.zeros((1, 1))})


class ExplainerJobTests(unittest.TestCase):
    def test_unreadable_snapshot_is_reported_as_failed(self):
        from app.xai.main import Explainer

        submitted = {}
        explainer = Explainer.__new__(Explainer)
        explainer.client = SimpleNamespace(
            fetch_asset=lambda _path: b"not an image",
            submit_explanation=lambda alert_id, body: submitted.update(alert_id=alert_id, body=body) or {"success": True},
        )
        explainer.cam = None
        explainer.risk = None
        explainer.handle({"alertId": "a1", "snapshotURL": "/uploads/snapshots/x.jpg", "boundingBoxes": []})
        self.assertEqual(submitted["alert_id"], "a1")
        self.assertEqual(submitted["body"]["status"], "failed")
        self.assertIn("decoded", submitted["body"]["error"])


@unittest.skipUnless(HAS_TORCH and PT.is_file() and ONNX.is_file() and VIDEO.is_file(), "torch/ultralytics, weights or demo video missing")
class LayerCamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.model.yolo_onnx import YoloOnnxDetector
        from app.xai.layercam import LayerCamExplainer

        cls.detector = YoloOnnxDetector(str(ONNX), str(CLASSES), 0.35, 0.45)
        cls.cam = LayerCamExplainer(str(PT), threads=2)
        cap = cv2.VideoCapture(str(VIDEO))
        cap.set(cv2.CAP_PROP_POS_FRAMES, 80)
        ok, cls.frame = cap.read()
        cap.release()
        assert ok, "could not read demo video frame"
        cls.boxes = [d.to_dict() for d in cls.detector.predict(cls.frame)]

    def test_pt_and_onnx_agree(self):
        self.assertLess(self.cam.verify_parity(self.detector.session), 1e-3)

    def test_heatmap_concentrates_on_the_detected_fire(self):
        self.assertTrue(any(b["className"] == "fire" for b in self.boxes), self.boxes)
        cam, targets = self.cam.explain(self.frame, self.boxes)
        self.assertEqual(cam.shape, self.frame.shape[:2])
        self.assertGreaterEqual(float(cam.min()), 0.0)
        self.assertLessEqual(float(cam.max()), 1.0)
        primary = max(targets, key=lambda t: t.confidence)
        # Measured 0.89 on this frame; vanilla Grad-CAM gave 0.12.
        self.assertGreater(primary.focus_in_box, 0.6)
        box = self.boxes[primary.box_index]
        self.assertTrue(box["x"] <= primary.peak[0] <= box["x"] + box["w"])

    def test_heatmap_is_deterministic_and_renders_as_jpeg(self):
        from app.xai.layercam import render_overlay

        first, targets = self.cam.explain(self.frame, self.boxes)
        second, _ = self.cam.explain(self.frame, self.boxes)
        np.testing.assert_allclose(first, second, atol=1e-5)
        jpeg = render_overlay(self.frame, first, self.boxes, targets)
        self.assertEqual(jpeg[:2], b"\xff\xd8")

    def test_frames_without_fire_or_smoke_are_skipped(self):
        cam, targets = self.cam.explain(self.frame, [{**self.boxes[0], "className": "other"}])
        self.assertIsNone(cam)
        self.assertEqual(targets, [])


if __name__ == "__main__":
    unittest.main()
