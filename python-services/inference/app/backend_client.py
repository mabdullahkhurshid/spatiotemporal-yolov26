from __future__ import annotations

import base64
import logging

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# Retry only transport/HTTP failures; programming errors (e.g. bad payloads) should surface immediately.
_retry_http = retry(
    retry=retry_if_exception_type(httpx.HTTPError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=1, max=8),
)


class BackendClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"X-Inference-Api-Key": api_key, "Content-Type": "application/json"}

    @_retry_http
    def fetch_cameras(self) -> list[dict]:
        with httpx.Client(timeout=30.0) as client:
            res = client.get(f"{self.base_url}/api/internal/inference/cameras", headers=self.headers)
            res.raise_for_status()
            payload = res.json()
            return payload.get("data", [])

    @_retry_http
    def ingest(self, body: dict) -> dict:
        with httpx.Client(timeout=60.0) as client:
            res = client.post(f"{self.base_url}/api/internal/inference/ingest", headers=self.headers, json=body)
            res.raise_for_status()
            return res.json()

    def ingest_with_snapshot(self, body: dict, jpeg_bytes: bytes | None) -> dict:
        if jpeg_bytes:
            body = {
                **body,
                "snapshotBase64": base64.b64encode(jpeg_bytes).decode("ascii"),
            }
        return self.ingest(body)
