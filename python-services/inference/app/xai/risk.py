"""False-alarm likelihood from numeric alert features, explained with SHAP.

Training (train_risk.py) and scoring (main.py) share `alert_features`, so a feature means the same in both.
The score is advisory: it never suppresses an alert or changes its severity.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

ALERT_CLASSES = ("fire", "smoke")
# focus_in_box is unknown when no heatmap was produced; trees split on the sentinel.
MISSING = -1.0
RISK_BANDS = ((0.6, "high"), (0.3, "medium"), (0.0, "low"))
TOP_CONTRIBUTIONS = 3

FEATURES: list[tuple[str, str]] = [
    ("fire_conf", "Fire confidence"),
    ("smoke_conf", "Smoke confidence"),
    ("both_classes", "Fire and smoke together"),
    ("other_score", "Model's \"other\" score on the main region"),
    ("box_count", "Number of fire/smoke regions"),
    ("coverage", "Share of the frame covered"),
    ("largest_box", "Largest region size"),
    ("box_center_y", "Vertical position of the main region"),
    ("spread_rate", "Growth of the detected area"),
    ("detection_freq", "Detections in the last minute"),
    ("streak_mean", "Average confidence over confirming frames"),
    ("focus_in_box", "Model focus inside the main region"),
    ("hour_sin", "Time of day"),
    ("hour_cos", "Time of day"),
    ("camera_fa_rate", "This camera's false-alarm history"),
    ("camera_closed", "Number of past alerts on this camera"),
]
FEATURE_NAMES = [name for name, _ in FEATURES]
FEATURE_LABELS = dict(FEATURES)


def _num(value, default: float = 0.0) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if math.isfinite(n) else default


def parse_time(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def alert_features(alert: dict, camera_history: dict | None = None, focus: float | None = None) -> dict[str, float]:
    """Feature vector for one alert. `alert` uses the backend field names (claim job or training export)."""
    boxes = [b for b in alert.get("boundingBoxes") or [] if b.get("className") in ALERT_CLASSES]
    decision = alert.get("decision") or (alert.get("explanation") or {}).get("decision") or {}
    metrics = alert.get("metricsSnapshot") or {}
    fire = _num(alert.get("fireConfidence")) / 100
    smoke = _num(alert.get("smokeConfidence")) / 100
    areas = [_num(b.get("w")) * _num(b.get("h")) for b in boxes]
    primary = max(boxes, key=lambda b: _num(b.get("confidence")), default=None)

    if focus is None:
        targets = ((alert.get("explanation") or {}).get("visual") or {}).get("targets") or []
        focus = max((_num(t.get("focusInBox"), MISSING) for t in targets), default=None)

    when = parse_time(alert.get("timestamp"))
    hour = (when.hour + when.minute / 60) if when else 0.0
    history = camera_history or {}
    closed = _num(history.get("closed"))
    false_alarms = _num(history.get("falseAlarms"))

    return {
        "fire_conf": fire,
        "smoke_conf": smoke,
        "both_classes": float(fire > 0 and smoke > 0),
        "other_score": _num((primary or {}).get("scores", {}).get("other")) / 100 if primary else 0.0,
        "box_count": float(len(boxes)),
        "coverage": _num(decision.get("coverage"), sum(areas)),
        "largest_box": max(areas, default=0.0),
        "box_center_y": (_num(primary.get("y")) + _num(primary.get("h")) / 2) if primary else 0.5,
        "spread_rate": _num(metrics.get("estimatedSpreadRate")),
        "detection_freq": _num(metrics.get("detectionFrequencyPerMin")),
        "streak_mean": _num(decision.get("streakMeanConfidence"), max(fire, smoke) * 100) / 100,
        "focus_in_box": MISSING if focus is None else float(focus),
        "hour_sin": math.sin(2 * math.pi * hour / 24),
        "hour_cos": math.cos(2 * math.pi * hour / 24),
        # Laplace-smoothed so a camera with no history starts at 50%, not 0%.
        "camera_fa_rate": (false_alarms + 1) / (closed + 2),
        "camera_closed": math.log1p(closed),
    }


def to_matrix(rows: list[dict[str, float]]) -> np.ndarray:
    return np.array([[row[name] for name in FEATURE_NAMES] for row in rows], dtype=np.float64)


def risk_level(probability: float) -> str:
    return next(level for floor, level in RISK_BANDS if probability >= floor)


def describe(feature: str, row: dict[str, float], history: dict | None) -> str:
    value = row[feature]
    label = FEATURE_LABELS[feature]
    if feature == "camera_fa_rate" and history:
        return f"{label} ({int(_num(history.get('falseAlarms')))} of {int(_num(history.get('closed')))} past alerts)"
    if feature == "focus_in_box":
        return f"{label} (not available)" if value == MISSING else f"{label} ({value * 100:.0f}%)"
    if feature in ("fire_conf", "smoke_conf", "other_score", "streak_mean", "coverage", "largest_box"):
        return f"{label} ({value * 100:.0f}%)"
    if feature == "both_classes":
        return label if value else "Only one of fire or smoke"
    if feature == "camera_closed":
        return f"{label} ({math.expm1(value):.0f})"
    if feature in ("hour_sin", "hour_cos"):
        return label
    return f"{label} ({value:g})"


def model_status(path: str, outcome: dict | None = None) -> dict:
    """Payload for POST /explanations/model-status: the saved model (if any) plus the last training outcome."""
    status = {"active": False, "lastResult": "loaded", **{k: v for k, v in (outcome or {}).items() if k in ("lastResult", "message", "requirements")}}
    if Path(path).is_file():
        import joblib

        try:
            artifact = joblib.load(path)
        except Exception as exc:
            return {**status, "active": False, "lastResult": "error", "message": f"Saved model unreadable: {exc}"[:300]}
        status.update(
            active=artifact.get("features") == FEATURE_NAMES,
            version=artifact.get("version"),
            trainedAt=artifact.get("trainedAt"),
            metrics=artifact.get("metrics"),
        )
    return status


class RiskScorer:
    """Loads weights/risk_model.joblib (written by train_risk.py) and explains each score with SHAP."""

    def __init__(self, artifact: dict):
        import shap  # explainer-only dependency (requirements-xai.txt)

        if artifact.get("features") != FEATURE_NAMES:
            raise ValueError("Risk model was trained on a different feature set; retrain it")
        self.model = artifact["model"]
        self.version = str(artifact.get("version", "unknown"))
        self.metrics = artifact.get("metrics") or {}
        self.explainer = shap.TreeExplainer(
            self.model,
            data=artifact["background"],
            model_output="probability",
            feature_perturbation="interventional",
        )

    @classmethod
    def load(cls, path: str) -> "RiskScorer | None":
        if not Path(path).is_file():
            logger.info("No false-alarm model at %s yet; risk scores are off until one is trained", path)
            return None
        import joblib

        return cls(joblib.load(path))

    def score(self, row: dict[str, float], history: dict | None = None) -> dict:
        x = to_matrix([row])
        probability = float(self.model.predict_proba(x)[0, 1])
        values = np.asarray(self.explainer.shap_values(x))
        # Older shap returns one array per class for classifiers; keep the false-alarm class.
        if values.ndim == 3:
            values = values[..., 1] if values.shape[-1] == 2 else values[1]
        values = values.reshape(-1)

        # Time of day is split into sin/cos; report it as one factor.
        impacts: dict[str, float] = {}
        for name, impact in zip(FEATURE_NAMES, values):
            key = "hour" if name in ("hour_sin", "hour_cos") else name
            impacts[key] = impacts.get(key, 0.0) + float(impact)
        top = sorted(impacts.items(), key=lambda kv: -abs(kv[1]))[:TOP_CONTRIBUTIONS]
        return {
            "probability": round(probability, 4),
            "level": risk_level(probability),
            "modelVersion": self.version,
            "contributions": [
                {
                    "feature": name,
                    "label": "Time of day" if name == "hour" else describe(name, row, history),
                    "value": None if name == "hour" else round(row[name], 4),
                    "impact": round(impact, 4),
                }
                for name, impact in top
            ],
        }
