from __future__ import annotations

import logging
import os
import re
import threading
import time

# Low-latency demuxing for live cameras; must be set before the first VideoCapture is created.
# An explicit OPENCV_FFMPEG_CAPTURE_OPTIONS (e.g. from docker-compose) wins.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay")

import cv2  # noqa: E402
import numpy as np  # noqa: E402

logger = logging.getLogger(__name__)

_CREDENTIALS = re.compile(r"(\b[a-z][a-z0-9+.-]*://)[^/@\s]+@", re.IGNORECASE)
_URL_SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)

RECONNECT_DELAY_S = 1.0
# How long read() waits for a frame newer than the last one it returned.
FRAME_WAIT_S = 3.0


def redact(url: str) -> str:
    """Hide user:password in stream URLs (ONVIF cameras arrive with credentials) before logging."""
    return _CREDENTIALS.sub(r"\1***@", url or "")


def _is_local_file(url: str) -> bool:
    """Plain paths and file:// URLs (the backend allows them with CAMERA_ALLOW_LOCAL_SOURCES)."""
    return bool(url) and (url.lower().startswith("file:") or not _URL_SCHEME.match(url))


class StreamReader:
    """Keeps a camera stream drained and hands out only its newest frame.

    A background thread grabs every frame as it arrives; read() returns the latest one. Reading one
    frame per inference cycle instead lets unread frames queue up in the decoder, so detections drift
    further behind the live picture every second (boxes that lag and then freeze).
    """

    def __init__(self, stream_url: str, camera_type: str = "ip_rtsp"):
        self.stream_url = stream_url
        self.camera_type = camera_type
        self._is_file = _is_local_file(stream_url)
        self._cap: cv2.VideoCapture | None = None
        self._cond = threading.Condition()
        self._frame: np.ndarray | None = None
        self._seq = 0  # bumped for every frame published by the grab thread
        self._served_seq = 0
        self._wanted = False
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def read(self) -> np.ndarray | None:
        """Newest frame captured after the previous call, or None if the stream delivers none in time."""
        self._ensure_running()
        with self._cond:
            self._wanted = True
            got = self._cond.wait_for(lambda: self._seq > self._served_seq, timeout=FRAME_WAIT_S)
            if not got:
                return None
            self._served_seq = self._seq
            return self._frame

    def close(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        self._thread = None
        self._release()

    def _ensure_running(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._grab_loop, name="stream-reader", daemon=True)
        self._thread.start()

    def _open(self) -> bool:
        self._release()
        self._cap = cv2.VideoCapture(self.stream_url)
        if not self._cap.isOpened():
            logger.warning("Could not open stream %s", redact(self.stream_url))
            self._release()
            return False
        return True

    def _release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def _grab_loop(self) -> None:
        frame_period = 0.0
        next_due = 0.0
        while not self._stop.is_set():
            if self._cap is None:
                if not self._open():
                    self._stop.wait(RECONNECT_DELAY_S)
                    continue
                if self._is_file:
                    # Files have no live clock: play them at their own frame rate, like the browser proxy does.
                    fps = self._cap.get(cv2.CAP_PROP_FPS) or 25.0
                    frame_period = 1.0 / min(max(fps, 1.0), 120.0)
                    next_due = time.monotonic()

            # grab() decodes and discards; the BGR copy is only made when a reader is waiting for one.
            if not self._cap.grab():
                if self._is_file and self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0):
                    continue  # end of a demo file: loop it
                logger.warning("Frame read failed for %s — reconnecting", redact(self.stream_url))
                self._release()
                self._stop.wait(RECONNECT_DELAY_S)
                continue

            with self._cond:
                wanted = self._wanted
            if wanted:
                ok, frame = self._cap.retrieve()
                if ok and frame is not None:
                    with self._cond:
                        self._frame = frame
                        self._seq += 1
                        self._wanted = False
                        self._cond.notify_all()

            if self._is_file:
                next_due += frame_period
                delay = next_due - time.monotonic()
                if delay > 0:
                    self._stop.wait(delay)
                else:
                    next_due = time.monotonic()  # fell behind (slow decode): don't try to catch up

        self._release()
