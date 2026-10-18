import json
import os
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from app.model.yolo_onnx import YoloOnnxDetector, _model_class_names, letterbox

ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = ROOT / "weights" / "best.onnx"
CLASSES = ROOT / "config" / "classes.json"


def _fake_detector(class_names, raw_output):
    det = YoloOnnxDetector.__new__(YoloOnnxDetector)
    det.conf_threshold = 0.35
    det.iou_threshold = 0.45
    det.class_names = class_names
    det.input_size = 960
    det.input_name = "images"
    det.output_name = "output0"
    det.session = SimpleNamespace(run=lambda _names, _feeds: [raw_output])
    return det


class DecodeTests(unittest.TestCase):
    def test_class_index_maps_to_configured_name(self):
        # One candidate box centred in the frame, highest score on class index 2.
        raw = np.zeros((1, 7, 1), dtype=np.float32)
        raw[0, 0:4, 0] = [480, 480, 200, 100]
        raw[0, 4:7, 0] = [0.05, 0.10, 0.90]
        det = _fake_detector(["fire", "other", "smoke"], raw)

        detections = det.predict(np.zeros((480, 640, 3), dtype=np.uint8))

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].class_name, "smoke")
        self.assertAlmostEqual(detections[0].confidence, 0.90, places=5)
        box = detections[0].to_dict()
        self.assertAlmostEqual(box["w"], 200 / 960, places=4)
        # The worker posts these dicts as JSON; numpy scalars would make httpx raise TypeError.
        json.dumps(box)

    def test_letterboxed_box_maps_back_to_original_frame(self):
        # 1280x720 frame: ratio 0.75, image occupies 960x540 with 210 px padding top and bottom.
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        x1, y1, x2, y2 = 400.0, 100.0, 800.0, 500.0  # box in original pixels
        r, top = 960 / 1280, 210
        raw = np.zeros((1, 7, 1), dtype=np.float32)
        raw[0, 0:4, 0] = [(x1 + x2) / 2 * r, (y1 + y2) / 2 * r + top, (x2 - x1) * r, (y2 - y1) * r]
        raw[0, 4:7, 0] = [0.9, 0.0, 0.0]
        det = _fake_detector(["fire", "other", "smoke"], raw).predict(frame)[0]
        self.assertAlmostEqual(det.x, x1 / 1280, places=4)
        self.assertAlmostEqual(det.y, y1 / 720, places=4)
        self.assertAlmostEqual(det.w, (x2 - x1) / 1280, places=4)
        self.assertAlmostEqual(det.h, (y2 - y1) / 720, places=4)

    def test_nms_is_class_aware(self):
        # Same box predicted as fire (0.9), smoke (0.8) and fire again (0.7).
        raw = np.zeros((1, 7, 3), dtype=np.float32)
        for i, scores in enumerate([[0.9, 0, 0], [0, 0, 0.8], [0.7, 0, 0]]):
            raw[0, 0:4, i] = [480, 480, 200, 200]
            raw[0, 4:7, i] = scores
        dets = _fake_detector(["fire", "other", "smoke"], raw).predict(np.zeros((960, 960, 3), dtype=np.uint8))
        self.assertEqual(sorted(d.class_name for d in dets), ["fire", "smoke"])

    def test_low_confidence_candidates_are_dropped(self):
        raw = np.zeros((1, 7, 1), dtype=np.float32)
        raw[0, 0:4, 0] = [480, 480, 200, 100]
        raw[0, 4:7, 0] = [0.10, 0.10, 0.20]
        det = _fake_detector(["fire", "other", "smoke"], raw)
        self.assertEqual(det.predict(np.zeros((480, 640, 3), dtype=np.uint8)), [])

    def test_metadata_names_parse_in_index_order(self):
        meta = SimpleNamespace(custom_metadata_map={"names": "{0: 'fire', 2: 'smoke', 1: 'other'}"})
        session = SimpleNamespace(get_modelmeta=lambda: meta)
        self.assertEqual(_model_class_names(session), ["fire", "other", "smoke"])

    def test_missing_metadata_falls_back(self):
        meta = SimpleNamespace(custom_metadata_map={})
        session = SimpleNamespace(get_modelmeta=lambda: meta)
        self.assertIsNone(_model_class_names(session))


try:
    from ultralytics.data.augment import LetterBox as UltralyticsLetterBox
except Exception:  # ultralytics is optional (training-side dependency)
    UltralyticsLetterBox = None


@unittest.skipUnless(UltralyticsLetterBox, "ultralytics not installed")
class UltralyticsParityTests(unittest.TestCase):
    def test_letterbox_matches_ultralytics_exactly(self):
        rng = np.random.default_rng(0)
        for h, w in [(720, 1280), (1080, 1920), (480, 640), (960, 960), (601, 333)]:
            frame = rng.integers(0, 255, size=(h, w, 3), dtype=np.uint8)
            ours, *_ = letterbox(frame, 960)
            theirs = UltralyticsLetterBox(new_shape=(960, 960), auto=False)(image=frame)
            self.assertEqual(ours.shape, theirs.shape, f"{w}x{h}")
            self.assertTrue(np.array_equal(ours, theirs), f"pixel mismatch for {w}x{h}")


@unittest.skipUnless(WEIGHTS.is_file(), "weights/best.onnx not present")
class RealModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.detector = YoloOnnxDetector(str(WEIGHTS), str(CLASSES), 0.35, 0.45)

    def test_classes_json_matches_model_metadata(self):
        with open(CLASSES, encoding="utf-8") as f:
            configured = json.load(f)["names"]
        self.assertEqual(_model_class_names(self.detector.session), configured)
        self.assertEqual(self.detector.class_names, configured)

    def test_model_runs_on_a_frame_within_budget(self):
        frame = np.full((720, 1280, 3), 127, dtype=np.uint8)
        self.detector.predict(frame)  # warm-up
        start = time.perf_counter()
        detections = self.detector.predict(frame)
        elapsed_ms = (time.perf_counter() - start) * 1000
        self.assertIsInstance(detections, list)
        print(f"\n  CPU inference on 1280x720 frame: {elapsed_ms:.0f} ms, {len(detections)} detections")
        budget = float(os.environ.get("INFERENCE_TEST_BUDGET_MS", "2000"))
        self.assertLess(elapsed_ms, budget)


if __name__ == "__main__":
    unittest.main()
