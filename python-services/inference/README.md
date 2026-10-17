# Inference service (ONNX / CPU)

Runs **YOLOv26** fire/smoke/other detection (Ultralytics → ONNX) on CCTV streams and reports to the Node backend.

## Setup

```bash
cd python-services/inference
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Place weights (already gitignored):

- `weights/best.onnx` (preferred on CPU)
- `weights/best.pt` (optional; not used by default runtime)

## Environment

Copy root `.env` values or set:

```
BACKEND_URL=http://localhost:5000
INFERENCE_SERVICE_API_KEY=change-me-inference-key
INFERENCE_MODEL_PATH=./weights/best.onnx
```

## Run

From the repo root, `npm run dev` starts the backend, frontend, and this worker together. To start only the worker (backend and MongoDB already running):

```bash
npm run inference
```

## Notes

- Default inference interval: 500ms (2 FPS per camera).
- Max concurrent cameras: 4 (override with `INFERENCE_MAX_CONCURRENT_CAMERAS`).
