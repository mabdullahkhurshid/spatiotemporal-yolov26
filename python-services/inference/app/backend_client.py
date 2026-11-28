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
        # One pooled client for every call (httpx clients are thread-safe). Building a client takes
        # ~0.5 s (TLS context setup); doing that per request held back every live detection by as much.
        self._http = httpx.Client(timeout=30.0)

    def close(self) -> None:
        self._http.close()

    @_retry_http
    def fetch_cameras(self) -> list[dict]:
        res = self._http.get(f"{self.base_url}/api/internal/inference/cameras", headers=self.headers)
        res.raise_for_status()
        payload = res.json()
        return payload.get("data", [])

    @_retry_http
    def ingest(self, body: dict) -> dict:
        res = self._http.post(
            f"{self.base_url}/api/internal/inference/ingest", headers=self.headers, json=body, timeout=60.0
        )
        res.raise_for_status()
        return res.json()

    @_retry_http
    def claim_explanations(self, limit: int = 1) -> list[dict]:
        res = self._http.post(
            f"{self.base_url}/api/internal/inference/explanations/claim", headers=self.headers, json={"limit": limit}
        )
        res.raise_for_status()
        return res.json().get("data", [])

    @_retry_http
    def submit_explanation(self, alert_id: str, body: dict) -> dict:
        res = self._http.post(
            f"{self.base_url}/api/internal/inference/explanations/{alert_id}",
            headers=self.headers,
            json=body,
            timeout=60.0,
        )
        # 409: the job was re-queued and answered elsewhere; nothing left to do.
        if res.status_code == 409:
            return {"success": False, "conflict": True}
        res.raise_for_status()
        return res.json()

    @_retry_http
    def report_model_status(self, body: dict) -> dict:
        res = self._http.post(
            f"{self.base_url}/api/internal/inference/explanations/model-status", headers=self.headers, json=body
        )
        res.raise_for_status()
        return res.json()

    @_retry_http
    def fetch_training_data(self, limit: int = 20000) -> list[dict]:
        res = self._http.get(
            f"{self.base_url}/api/internal/inference/explanations/training-data",
            headers=self.headers,
            params={"limit": limit},
            timeout=120.0,
        )
        res.raise_for_status()
        return res.json().get("data", [])

    @_retry_http
    def fetch_asset(self, path: str) -> bytes:
        """Download a stored snapshot (e.g. /uploads/snapshots/...)."""
        if not path.startswith("/uploads/"):
            raise ValueError(f"Refusing to fetch non-upload path: {path!r}")
        # Stored media requires the service key (the backend no longer serves /uploads publicly).
        res = self._http.get(f"{self.base_url}{path}", headers=self.headers)
        res.raise_for_status()
        return res.content

    def ingest_with_snapshot(self, body: dict, jpeg_bytes: bytes | None) -> dict:
        if jpeg_bytes:
            body = {
                **body,
                "snapshotBase64": base64.b64encode(jpeg_bytes).decode("ascii"),
            }
        return self.ingest(body)
