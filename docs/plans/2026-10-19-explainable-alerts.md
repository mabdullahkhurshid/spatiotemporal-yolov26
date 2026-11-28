# Iteration 14 — Explainable Alerts (XAI)

**Date:** 2026-10-19
**Status:** Approved 2026-10-19

## Goal

Every alert answers two questions for the operator:

1. **Why did the rules fire?** — thresholds, confirming frames, severity band (exact decision trace).
2. **What did the model look at?** — a per-box LayerCAM heatmap plus "model focus inside box".

Later, once operators have labelled enough alerts, a SHAP-explained **false-alarm likelihood** is added (advisory only).

## Technique selection

| Technique | Use | Reason |
|---|---|---|
| Decision trace (rules) | Phase 14.1 | The alert is produced by deterministic rules (`IncidentTracker` + severity bands), so an exact trace is the correct explanation. |
| LayerCAM (Grad-CAM family) | Phase 14.2 | One forward + backward pass on `best.pt` (same weights as `best.onnx`), deterministic, per-box. Feasibility probe on the demo video: vanilla Grad-CAM put 12–17% of attention inside the alert box (mostly background); LayerCAM with a box-level target on the Detect classification branch (`cv3[s][0]`) put 89–100% inside, ~3 s on CPU. |
| SHAP (TreeExplainer) | Phase 14.3 | Exact and fast on a tabular gradient-boosted false-alarm model trained from operator outcomes. |
| LIME | Rejected | ~300 perturbed samples × ~475 ms per CPU forward pass ≈ 2.4 min per alert, stochastic (unsuitable for an audit trail), grey-patch masking of diffuse smoke is out of distribution. |

## Decisions

- Live detection keeps ONNX; explanations use `best.pt` (same weights) in a **separate explainer process / container**. Live `requirements.txt` is unchanged; explainer dependencies live in `requirements-xai.txt`.
- Alerts are never delayed by explanations: the heatmap arrives asynchronously (`alert:explained`).
- `averageConfidence` keeps its current meaning (peak of the confirming frame); a true mean over the confirming frames is added as `explanation.decision.streakMeanConfidence`.
- False-alarm model: one **global** model on numeric features only (no images, no organization identifiers). Per-organization models would not reach a usable label count.
- False-alarm likelihood is **advisory only**: it never suppresses an alert and never changes severity.
- All schema changes are additive; no endpoint, field, role, route, env var or Redux state is renamed or removed.

## Phases

### 14.1 — Decision trace + false-alarm cause capture

- Detector keeps the per-box score of every class (`scores: { fire, smoke, other }`) from the same forward pass.
- `IncidentTracker` keeps the confirming frames and, with `createAlert`, sends `metrics.evidence` (rule, thresholds, frames, true streak mean).
- Backend: `services/alertExplanation.js` builds `alert.explanation.decision` + plain-language `reasons`; severity bands move there (values unchanged). `metricsSnapshot.incidentDurationSec` is filled. Reasons are added to the alert email.
- `PUT /api/alerts/:id/false-alarm` accepts an optional `cause` (stored in `falseAlarmCause`) — these labels feed Phase 14.3.
- UI: "Why this alert" section in the alert drawer; false-alarm dialog with cause choices; corrected "average confidence" copy.

### 14.2 — LayerCAM heatmaps (explainer process)

- Ingest marks `explanation.visual.status = 'pending'` when `XAI_ENABLED=true`, a snapshot exists and the alert has fire/smoke boxes.
- `POST /api/internal/inference/explanations/claim` (API key) atomically claims pending jobs (stale claims re-queued after 5 min).
- `python -m app.xai.main` downloads the snapshot, runs LayerCAM on up to 3 fire/smoke boxes, posts the overlay + per-box focus to `POST /api/internal/inference/explanations/:alertId`.
- Backend stores the overlay under `uploads/explanations/<org>/<alertId>-<random>.jpg` and emits `alert:explained` to the same audience as `alert:new`.
- UI: Original / Model focus toggle; per-box focus with a low-focus warning (< 50%).
- Startup guard: explainer compares `best.pt` and `best.onnx` outputs on a fixed input and refuses to explain on mismatch.

### 14.3 — SHAP false-alarm likelihood (gated on labels)

- `GET /api/internal/inference/explanations/training-data` exports closed alerts (numeric features + outcome).
- `python -m app.xai.train_risk` trains a `GradientBoostingClassifier` once ≥150 labelled alerts with ≥30 per class exist; reports cross-validated ROC-AUC and Brier score; saves `weights/risk_model.joblib`.
- Labels: `false_alarm` → 1; resolved as `EXTINGUISHED` / `EVACUATED` → 0; `TEST_DRILL` / `OTHER` excluded.
- The explainer adds `explanation.risk` (probability, level, top SHAP contributions) when the model file exists.
- UI: "False-alarm likelihood" with top factors and an advisory note.

### 14.4 — Insights and visibility

- The explainer retrains the false-alarm model on start-up and every `XAI_RETRAIN_HOURS`, and reports its state (`XaiModelStatus`).
- `GET /api/alerts/insights`: false-alarm causes, per-camera false-alarm rate / main cause / model focus / look-alike flags, detection location grid per camera, model state.
- Reports gets an "Explainable AI" section; the super admin dashboard shows the model card.
- Notifications include the main reason; `npm run seed:xai-demo` gives development databases labelled sample alerts.

## Validation

- `npm run test:inference`: detector scores, tracker evidence, LayerCAM focus on the demo video, determinism, risk features/training.
- `npm test`: ingest stores explanation, cause capture, claim/submit API key + atomic claim, `alert:explained` audience, training export.
- `npm run build` (frontend).
