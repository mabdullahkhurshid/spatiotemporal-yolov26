"""Train the false-alarm likelihood model from operator outcomes.

    python -m app.xai.train_risk            # fetch closed alerts from the backend, train, save
    python -m app.xai.train_risk --dry-run  # report label counts and metrics without saving

Labels: false_alarm -> 1; resolved as EXTINGUISHED or EVACUATED -> 0. Drills and "other" outcomes are
left out because they say nothing about whether the detection was real.
"""
from __future__ import annotations

import argparse
import logging
import sys
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np

from app.config import settings
from app.xai.risk import FEATURE_NAMES, alert_features, parse_time, to_matrix

logger = logging.getLogger("inference.xai.train")

REAL_FIRE_OUTCOMES = {"EXTINGUISHED", "EVACUATED"}
BACKGROUND_ROWS = 100
CV_FOLDS = 5


def label_of(alert: dict) -> int | None:
    if alert.get("status") == "false_alarm":
        return 1
    if alert.get("status") == "resolved" and alert.get("resolutionType") in REAL_FIRE_OUTCOMES:
        return 0
    return None


def build_dataset(alerts: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Features with the camera history each alert had *when it was raised* (no look-ahead)."""
    closed_by_camera: dict[str, list[tuple[datetime, int]]] = defaultdict(list)
    for alert in alerts:
        resolved_at = parse_time(alert.get("resolvedAt"))
        if resolved_at:
            closed_by_camera[str(alert.get("cameraId"))].append((resolved_at, int(alert.get("status") == "false_alarm")))

    rows, labels = [], []
    for alert in alerts:
        label = label_of(alert)
        when = parse_time(alert.get("timestamp"))
        if label is None or when is None:
            continue
        # Same definition as the backend claim job: closed before this alert was raised.
        prior = [
            fa
            for resolved_at, fa in closed_by_camera[str(alert.get("cameraId"))]
            if resolved_at < when
        ]
        history = {"closed": len(prior), "falseAlarms": sum(prior)}
        rows.append(alert_features(alert, history))
        labels.append(label)
    if not rows:
        return np.empty((0, len(FEATURE_NAMES))), np.empty((0,), dtype=int)
    return to_matrix(rows), np.array(labels, dtype=int)


def train(x: np.ndarray, y: np.ndarray, seed: int = 0) -> tuple[object, dict]:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import StratifiedKFold, cross_val_predict

    def make():
        return GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=seed)

    folds = min(CV_FOLDS, int(np.bincount(y).min()))
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
    oof = cross_val_predict(make(), x, y, cv=cv, method="predict_proba")[:, 1]
    metrics = {
        "rocAuc": round(float(roc_auc_score(y, oof)), 4),
        "brier": round(float(brier_score_loss(y, oof)), 4),
        "folds": folds,
        "samples": int(len(y)),
        "falseAlarms": int(y.sum()),
    }
    model = make().fit(x, y)
    return model, metrics


def make_artifact(model, metrics: dict, x: np.ndarray, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    background = x[rng.choice(len(x), size=min(BACKGROUND_ROWS, len(x)), replace=False)]
    trained_at = datetime.now(timezone.utc)
    return {
        "model": model,
        "features": FEATURE_NAMES,
        "background": background,
        "metrics": metrics,
        "trainedAt": trained_at.isoformat(),
        "version": f"risk-{trained_at:%Y%m%d%H%M}-n{metrics['samples']}",
    }


REQUIREMENTS = {"minSamples": 150, "minPerClass": 30, "minAuc": 0.6}


def attempt_training(client, out: str, requirements: dict | None = None, dry_run: bool = False) -> dict:
    """Fetch labels, train and save if the label and quality gates pass. Returns the outcome for model-status."""
    req = {**REQUIREMENTS, **(requirements or {})}
    result = {"requirements": req}
    try:
        alerts = client.fetch_training_data()
    except Exception as exc:
        logger.error("Could not fetch training data from %s: %s", settings.backend_url, exc)
        return {**result, "lastResult": "error", "message": f"Could not fetch training data: {exc}"[:300]}

    x, y = build_dataset(alerts)
    positives, negatives = int(y.sum()), int(len(y) - y.sum())
    logger.info("%d closed alerts, %d labelled: %d false alarms, %d real fires", len(alerts), len(y), positives, negatives)
    if len(y) < req["minSamples"] or min(positives, negatives) < req["minPerClass"]:
        message = (
            f"Not enough labels yet: {len(y)} labelled ({positives} false alarms, {negatives} real fires); "
            f"need {req['minSamples']} with at least {req['minPerClass']} of each"
        )
        logger.warning("%s; no model written", message)
        return {**result, "lastResult": "not_enough_labels", "message": message}

    model, metrics = train(x, y)
    logger.info("Cross-validated ROC-AUC %.3f, Brier %.3f over %d folds", metrics["rocAuc"], metrics["brier"], metrics["folds"])
    if metrics["rocAuc"] < req["minAuc"]:
        message = f"Cross-validated ROC-AUC {metrics['rocAuc']:.3f} is below {req['minAuc']}; previous model kept"
        logger.warning("%s", message)
        return {**result, "lastResult": "low_auc", "message": message, "candidateMetrics": metrics}
    if dry_run:
        return {**result, "lastResult": "trained", "message": "Dry run: model not saved", "candidateMetrics": metrics}

    import joblib

    artifact = make_artifact(model, metrics, x)
    joblib.dump(artifact, out)
    logger.info("Saved %s to %s", artifact["version"], out)
    return {**result, "lastResult": "trained", "message": f"Trained on {metrics['samples']} labelled alerts"}


EXIT_CODES = {"trained": 0, "error": 1, "not_enough_labels": 2, "low_auc": 3}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--min-samples", type=int, default=REQUIREMENTS["minSamples"])
    parser.add_argument("--min-per-class", type=int, default=REQUIREMENTS["minPerClass"])
    parser.add_argument("--min-auc", type=float, default=REQUIREMENTS["minAuc"], help="Refuse to save a model below this CV ROC-AUC")
    parser.add_argument("--out", default=settings.xai_risk_model_path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    from app.backend_client import BackendClient
    from app.xai.risk import model_status

    client = BackendClient(settings.backend_url, settings.inference_service_api_key)
    requirements = {"minSamples": args.min_samples, "minPerClass": args.min_per_class, "minAuc": args.min_auc}
    outcome = attempt_training(client, args.out, requirements, dry_run=args.dry_run)
    if not args.dry_run and outcome["lastResult"] != "error":
        try:
            client.report_model_status(model_status(args.out, outcome))
        except Exception as exc:
            logger.warning("Could not report model status to the backend: %s", exc)
    return EXIT_CODES[outcome["lastResult"]]


if __name__ == "__main__":
    sys.exit(main())
