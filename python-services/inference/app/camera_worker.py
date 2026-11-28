from __future__ import annotations

import logging
import threading
import time

import cv2

from app.analytics.incident_tracker import IncidentTracker
from app.backend_client import BackendClient
from app.config import settings
from app.model.yolo_onnx import YoloOnnxDetector
from app.stream.stream_reader import StreamReader

logger = logging.getLogger(__name__)


class CameraWorker:
    def __init__(self, camera: dict, detector: YoloOnnxDetector, client: BackendClient):
        self.camera = camera
        self.detector = detector
        self.client = client
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        alert_classes = {c.strip() for c in settings.alert_classes.split(",") if c.strip()}
        self.tracker = IncidentTracker(
            alert_classes=alert_classes,
            min_consecutive=settings.min_consecutive,
            alert_cooldown_ms=settings.alert_cooldown_ms,
            incident_end_silence_ms=settings.incident_end_silence_ms,
            incident_min_consecutive=settings.incident_min_consecutive,
        )
        self.reader = StreamReader(camera.get("streamUrl", ""), camera.get("cameraType", "ip_rtsp"))

    @property
    def camera_id(self) -> str:
        return str(self.camera.get("_id"))

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name=f"camera-{self.camera_id}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.reader.close()

    def _run(self) -> None:
        logger.info("Worker started for camera %s", self.camera_id)
        interval = settings.frame_interval_ms / 1000.0
        while not self._stop.is_set():
            loop_start = time.time()
            try:
                frame = self.reader.read()
                if frame is None:
                    self.client.ingest(
                        {
                            "cameraId": self.camera_id,
                            "streamStatus": "degraded",
                            "detections": [],
                        }
                    )
                    time.sleep(interval)
                    continue

                detections = self.detector.predict(frame)
                det_dicts = [d.to_dict() for d in detections]
                metrics = self.tracker.update(det_dicts)
                if "evidence" in metrics:
                    # Detector-side rule values the tracker does not own.
                    metrics["evidence"]["confThreshold"] = round(settings.conf_threshold * 100, 2)
                    metrics["evidence"]["frameIntervalMs"] = settings.frame_interval_ms
                body = {
                    "cameraId": self.camera_id,
                    "streamStatus": "ok",
                    "detections": det_dicts,
                    "metrics": metrics,
                }

                jpeg_bytes = None
                if metrics.get("createAlert"):
                    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                    if ok:
                        jpeg_bytes = buf.tobytes()

                if metrics.get("incidentEnded"):
                    body["incidentEnded"] = True
                    body["incident"] = {
                        "startedAt": metrics.get("startedAt"),
                        "endedAt": metrics.get("endedAt"),
                    }

                self.client.ingest_with_snapshot(body, jpeg_bytes)
            except Exception:
                logger.exception("Worker error camera %s", self.camera_id)
            elapsed = time.time() - loop_start
            time.sleep(max(0.0, interval - elapsed))
        logger.info("Worker stopped for camera %s", self.camera_id)
