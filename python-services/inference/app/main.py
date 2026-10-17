from __future__ import annotations

import logging
import signal
import sys
import time

from app.backend_client import BackendClient
from app.camera_worker import CameraWorker
from app.config import settings
from app.model.yolo_onnx import YoloOnnxDetector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inference.main")


class Supervisor:
    def __init__(self) -> None:
        self.client = BackendClient(settings.backend_url, settings.inference_service_api_key)
        self.detector = YoloOnnxDetector(
            settings.model_path,
            settings.classes_path,
            settings.conf_threshold,
            settings.iou_threshold,
        )
        self.workers: dict[str, CameraWorker] = {}
        self._running = True

    def sync_workers(self) -> None:
        try:
            cameras = self.client.fetch_cameras()
        except Exception:
            logger.exception("Failed to fetch camera registry")
            return

        active_ids = set()
        for cam in cameras[: settings.max_concurrent_cameras]:
            cam_id = str(cam.get("_id"))
            if not cam.get("streamUrl"):
                continue
            active_ids.add(cam_id)
            if cam_id not in self.workers:
                worker = CameraWorker(cam, self.detector, self.client)
                self.workers[cam_id] = worker
                worker.start()
                logger.info("Started worker for %s", cam_id)
            else:
                self.workers[cam_id].camera = cam

        for cam_id in list(self.workers.keys()):
            if cam_id not in active_ids:
                logger.info("Stopping worker for %s", cam_id)
                self.workers[cam_id].stop()
                del self.workers[cam_id]

    def run(self) -> None:
        logger.info("Inference supervisor running (ONNX CPU, model=%s)", settings.model_path)
        poll_s = settings.camera_registry_poll_ms / 1000.0
        while self._running:
            self.sync_workers()
            time.sleep(poll_s)

    def shutdown(self) -> None:
        self._running = False
        for worker in self.workers.values():
            worker.stop()
        self.workers.clear()


def main() -> None:
    supervisor = Supervisor()

    def handle_signal(_signum, _frame):
        logger.info("Shutdown signal received")
        supervisor.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    supervisor.run()


if __name__ == "__main__":
    main()
