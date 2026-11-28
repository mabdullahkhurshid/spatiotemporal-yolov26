"""Explainer process: turns alert snapshots into LayerCAM heatmaps and false-alarm likelihoods.

    python -m app.xai.main

Runs separately from the live detector so explanations never delay detection or alerts.
"""
from __future__ import annotations

import base64
import logging
import signal
import sys
import time
from pathlib import Path

import cv2
import numpy as np

from app.backend_client import BackendClient
from app.config import settings
from app.xai.layercam import LayerCamExplainer, render_overlay
from app.xai.risk import RiskScorer, alert_features, model_status
from app.xai.train_risk import attempt_training

logger = logging.getLogger("inference.xai")

MODEL_INFO = "LayerCAM on best.pt (Detect cls branch, box-level target)"


class Explainer:
    def __init__(self) -> None:
        self.client = BackendClient(settings.backend_url, settings.inference_service_api_key)
        self.cam = LayerCamExplainer(settings.xai_model_path, threads=settings.xai_torch_threads)
        self._check_parity()
        self.risk = self._load_risk()
        self._risk_mtime = self._model_mtime()
        self._next_training = 0.0  # train (or at least report status) right after start-up
        self._running = True

    def _check_parity(self) -> None:
        import onnxruntime as ort

        session = ort.InferenceSession(settings.model_path, providers=["CPUExecutionProvider"])
        diff = self.cam.verify_parity(session)
        logger.info("best.pt matches best.onnx (max class score difference %.1e)", diff)

    @staticmethod
    def _model_mtime() -> float | None:
        path = Path(settings.xai_risk_model_path)
        return path.stat().st_mtime if path.is_file() else None

    def _reload_risk_if_changed(self) -> None:
        """Pick up a model written by `npm run train:risk` or by the scheduled retrain."""
        mtime = self._model_mtime()
        if mtime != self._risk_mtime:
            self._risk_mtime = mtime
            self.risk = self._load_risk()
            logger.info("False-alarm model %s", f"reloaded ({self.risk.version})" if self.risk else "removed")

    def retrain_if_due(self) -> None:
        if time.monotonic() < self._next_training:
            return
        hours = settings.xai_retrain_hours
        # 0 disables the schedule after the start-up attempt.
        self._next_training = time.monotonic() + hours * 3600 if hours > 0 else float("inf")
        requirements = {"minSamples": settings.xai_min_samples, "minPerClass": settings.xai_min_per_class}
        outcome = attempt_training(self.client, settings.xai_risk_model_path, requirements)
        self._reload_risk_if_changed()
        try:
            self.client.report_model_status(model_status(settings.xai_risk_model_path, outcome))
        except Exception:
            logger.exception("Could not report false-alarm model status")

    @staticmethod
    def _load_risk() -> RiskScorer | None:
        try:
            return RiskScorer.load(settings.xai_risk_model_path)
        except Exception:
            logger.exception("False-alarm model could not be loaded; continuing without risk scores")
            return None

    def handle(self, job: dict) -> None:
        alert_id = str(job["alertId"])
        boxes = job.get("boundingBoxes") or []
        started = time.perf_counter()
        body: dict = {"method": "layercam", "modelInfo": MODEL_INFO}
        focus = None
        try:
            data = self.client.fetch_asset(job.get("snapshotURL") or "")
            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("snapshot could not be decoded")
            cam, targets = self.cam.explain(frame, boxes, max_targets=settings.xai_max_targets)
            if cam is None:
                body.update(status="skipped", error="no fire/smoke boxes to explain")
            else:
                body.update(
                    status="ready",
                    heatmapBase64=base64.b64encode(render_overlay(frame, cam, boxes, targets)).decode("ascii"),
                    targets=[t.to_dict() for t in targets],
                )
                focus = max(t.focus_in_box for t in targets)
        except Exception as exc:
            logger.exception("Heatmap failed for alert %s", alert_id)
            body.update(status="failed", error=f"{type(exc).__name__}: {exc}"[:300])

        if self.risk:
            features = job.get("features") or {}
            history = features.get("cameraHistory")
            try:
                row = alert_features({**features, "boundingBoxes": boxes}, history, focus)
                body["risk"] = self.risk.score(row, history)
            except Exception:
                logger.exception("False-alarm score failed for alert %s", alert_id)

        body["durationMs"] = round((time.perf_counter() - started) * 1000)
        result = self.client.submit_explanation(alert_id, body)
        if result.get("conflict"):
            logger.info("Alert %s was already explained elsewhere", alert_id)
        else:
            logger.info("Alert %s explained: %s in %d ms", alert_id, body["status"], body["durationMs"])

    def run(self) -> None:
        logger.info("Explainer running (poll every %d ms, %d torch threads)", settings.xai_poll_ms, settings.xai_torch_threads)
        while self._running:
            try:
                self.retrain_if_due()
                self._reload_risk_if_changed()
            except Exception:
                logger.exception("False-alarm model training failed")
            try:
                jobs = self.client.claim_explanations(limit=1)
            except Exception:
                logger.exception("Could not claim explanation jobs")
                jobs = []
            for job in jobs:
                try:
                    self.handle(job)
                except Exception:
                    # The claim expires and the job is retried after the backend's stale-claim timeout.
                    logger.exception("Could not submit explanation for alert %s", job.get("alertId"))
            if not jobs:
                time.sleep(settings.xai_poll_ms / 1000.0)

    def shutdown(self) -> None:
        self._running = False


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    explainer = Explainer()

    def handle_signal(_signum, _frame):
        logger.info("Shutdown signal received")
        explainer.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    explainer.run()


if __name__ == "__main__":
    main()
