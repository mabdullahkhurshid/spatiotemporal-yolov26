from __future__ import annotations

import logging
import re
import time

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_CREDENTIALS = re.compile(r"(\b[a-z][a-z0-9+.-]*://)[^/@\s]+@", re.IGNORECASE)


def redact(url: str) -> str:
    """Hide user:password in stream URLs (ONVIF cameras arrive with credentials) before logging."""
    return _CREDENTIALS.sub(r"\1***@", url or "")


class StreamReader:
    def __init__(self, stream_url: str, camera_type: str = "ip_rtsp"):
        self.stream_url = stream_url
        self.camera_type = camera_type
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> bool:
        self.close()
        self._cap = cv2.VideoCapture(self.stream_url)
        if self.camera_type in ("ip_rtsp", "onvif"):
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return bool(self._cap.isOpened())

    def read(self) -> np.ndarray | None:
        if not self._cap or not self._cap.isOpened():
            if not self.open():
                return None
        ok, frame = self._cap.read()
        if not ok or frame is None:
            logger.warning("Frame read failed for %s — reconnecting", redact(self.stream_url))
            self.open()
            time.sleep(0.5)
            return None
        return frame

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
