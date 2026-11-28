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

## Explainer (explainable alerts)

A second process explains alerts after they are raised. It never runs inside the live detector.

- **LayerCAM heatmap** (Grad-CAM family) on `weights/best.pt`, the same weights as `best.onnx`; the explainer checks the two agree at start-up. Each fire/smoke box gets a "model focus inside box" share.
- **False-alarm likelihood** with SHAP contributions, once a model has been trained from operator outcomes.

```bash
pip install -r requirements-xai.txt   # torch (CPU), ultralytics, scikit-learn, shap
npm run explainer                     # from the repo root; needs XAI_ENABLED=true on the backend
npm run train:risk                    # writes weights/risk_model.joblib once enough alerts are labelled
```

`npm run dev:xai` starts the backend, frontend, detector and explainer together. In Docker, the `explainer` compose service does the same (`Dockerfile.explainer`). Settings: `XAI_MODEL_PATH`, `XAI_RISK_MODEL_PATH`, `XAI_POLL_MS`, `XAI_TORCH_THREADS`, `XAI_MAX_TARGETS`.

The explainer also trains the model itself on start-up and every `XAI_RETRAIN_HOURS` (default 24). It reloads a model written by `npm run train:risk` and reports the model's state, which is shown in Reports. For a development database with no history, `npm run seed:xai-demo -- --camera <id>` adds labelled sample alerts; `--remove` deletes them. Delete `weights/risk_model.joblib` afterwards if a model was trained on them.

Training needs at least 150 labelled alerts with 30 of each outcome. False alarms are positives; alerts resolved as extinguished or evacuated are negatives. Drills and "other" outcomes are left out. The model is retrained on demand, and its score is advisory only.
