import unittest

import httpx

from app.backend_client import BackendClient


class FetchAssetTest(unittest.TestCase):
    def setUp(self):
        self.requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            return httpx.Response(200, content=b"\xff\xd8\xffjpeg")

        self.client = BackendClient("http://backend:5000/", "secret-key")
        self.client._http.close()
        self.client._http = httpx.Client(transport=httpx.MockTransport(handler))

    def tearDown(self):
        self.client.close()

    def test_fetch_asset_sends_service_key(self):
        data = self.client.fetch_asset("/uploads/snapshots/abc/cam-1.jpg")

        self.assertEqual(data, b"\xff\xd8\xffjpeg")
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(str(self.requests[0].url), "http://backend:5000/uploads/snapshots/abc/cam-1.jpg")
        self.assertEqual(self.requests[0].headers.get("x-inference-api-key"), "secret-key")

    def test_fetch_asset_refuses_non_upload_paths(self):
        with self.assertRaises(ValueError):
            self.client.fetch_asset("/api/internal/inference/cameras")
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
