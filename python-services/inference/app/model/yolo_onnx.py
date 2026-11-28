from __future__ import annotations

import ast
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    class_name: str
    confidence: float
    x: float
    y: float
    w: float
    h: float
    # Score of every class for this box (0–1). The runner-up class explains look-alikes ("other").
    scores: dict[str, float] | None = None

    def to_dict(self) -> dict:
        # Coordinates come from numpy (float32); cast so the payload is JSON serializable.
        out = {
            "className": self.class_name,
            "confidence": round(float(self.confidence) * 100, 2),
            "x": round(float(self.x), 6),
            "y": round(float(self.y), 6),
            "w": round(float(self.w), 6),
            "h": round(float(self.h), 6),
        }
        if self.scores:
            out["scores"] = {name: round(float(s) * 100, 2) for name, s in self.scores.items()}
        return out


def _model_class_names(session: ort.InferenceSession) -> list[str] | None:
    """Read Ultralytics `names` metadata (e.g. "{0: 'fire', 1: 'other', 2: 'smoke'}") in index order."""
    raw = session.get_modelmeta().custom_metadata_map.get("names")
    if not raw:
        return None
    try:
        names = ast.literal_eval(raw)
    except (ValueError, SyntaxError):
        logger.warning("Could not parse model class names metadata: %r", raw)
        return None
    if isinstance(names, dict):
        return [str(names[k]) for k in sorted(names, key=int)]
    if isinstance(names, (list, tuple)):
        return [str(n) for n in names]
    return None


PAD_VALUE = 114  # Ultralytics letterbox padding colour
MAX_WH = 7680  # Ultralytics class offset for class-aware NMS
MAX_DET = 300


def letterbox(frame_bgr: np.ndarray, size: int) -> tuple[np.ndarray, float, int, int]:
    """Aspect-preserving resize + centred padding, matching ultralytics.data.augment.LetterBox (auto=False).

    Returns (image, ratio, pad_left, pad_top).
    """
    h, w = frame_bgr.shape[:2]
    r = min(size / h, size / w)
    new_w, new_h = round(w * r), round(h * r)
    dw, dh = (size - new_w) / 2, (size - new_h) / 2
    img = frame_bgr
    if (w, h) != (new_w, new_h):
        img = cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    top, bottom = round(dh - 0.1), round(dh + 0.1)
    left, right = round(dw - 0.1), round(dw + 0.1)
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(PAD_VALUE,) * 3)
    return img, r, left, top


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> list[int]:
    if len(boxes) == 0:
        return []
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    return keep


class YoloOnnxDetector:
    def __init__(self, model_path: str, classes_path: str, conf_threshold: float, iou_threshold: float):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        with open(classes_path, encoding="utf-8") as f:
            meta = json.load(f)
        self.class_names: list[str] = meta.get("names", ["fire", "smoke", "other"])
        self.input_size: int = int(meta.get("inputSize", 960))

        model_file = Path(model_path)
        if not model_file.is_file():
            raise FileNotFoundError(f"ONNX model not found: {model_path}")

        self.session = ort.InferenceSession(
            str(model_file),
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

        # The exported model records its own class order; a mismatched classes.json would swap labels.
        model_names = _model_class_names(self.session)
        if model_names:
            if model_names != self.class_names:
                logger.warning(
                    "classes.json names %s differ from model metadata %s; using model metadata",
                    self.class_names,
                    model_names,
                )
            self.class_names = model_names

    def _preprocess(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, float, int, int]:
        # Letterbox like Ultralytics training/inference; stretching distorts non-square CCTV frames.
        img, ratio, pad_left, pad_top = letterbox(frame_bgr, self.input_size)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)
        return np.ascontiguousarray(img), ratio, pad_left, pad_top

    def predict(self, frame_bgr: np.ndarray) -> list[Detection]:
        orig_h, orig_w = frame_bgr.shape[:2]
        tensor, ratio, pad_left, pad_top = self._preprocess(frame_bgr)
        outputs = self.session.run([self.output_name], {self.input_name: tensor})
        raw = outputs[0]
        if raw.ndim == 3:
            pred = raw[0].T
        else:
            pred = raw.T

        if pred.shape[1] < 5:
            return []

        boxes_xywh = pred[:, :4]
        class_scores = pred[:, 4:]
        class_ids = np.argmax(class_scores, axis=1)
        confidences = class_scores[np.arange(len(class_ids)), class_ids]

        mask = confidences >= self.conf_threshold
        boxes_xywh = boxes_xywh[mask]
        confidences = confidences[mask]
        class_ids = class_ids[mask]
        class_scores = class_scores[mask]

        if len(boxes_xywh) == 0:
            return []

        # Undo letterbox: remove padding, then scale back to the original frame (as ultralytics scale_boxes).
        cx, cy, bw, bh = boxes_xywh[:, 0], boxes_xywh[:, 1], boxes_xywh[:, 2], boxes_xywh[:, 3]
        x1 = np.clip((cx - bw / 2 - pad_left) / ratio, 0, orig_w)
        y1 = np.clip((cy - bh / 2 - pad_top) / ratio, 0, orig_h)
        x2 = np.clip((cx + bw / 2 - pad_left) / ratio, 0, orig_w)
        y2 = np.clip((cy + bh / 2 - pad_top) / ratio, 0, orig_h)
        boxes_xyxy = np.stack([x1, y1, x2, y2], axis=1)

        # Class-aware NMS (Ultralytics default): overlapping fire and smoke boxes are both kept.
        offsets = class_ids[:, None].astype(np.float32) * MAX_WH
        keep = _nms(boxes_xyxy + offsets, confidences, self.iou_threshold)[:MAX_DET]
        detections: list[Detection] = []
        for idx in keep:
            x1i, y1i, x2i, y2i = boxes_xyxy[idx]
            detections.append(
                Detection(
                    class_name=self.class_names[int(class_ids[idx])],
                    confidence=float(confidences[idx]),
                    x=max(0.0, x1i / orig_w),
                    y=max(0.0, y1i / orig_h),
                    w=min(1.0, (x2i - x1i) / orig_w),
                    h=min(1.0, (y2i - y1i) / orig_h),
                    scores=dict(zip(self.class_names, class_scores[idx].tolist())),
                )
            )
        return detections
