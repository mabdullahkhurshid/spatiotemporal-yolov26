from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


@dataclass
class Detection:
    class_name: str
    confidence: float
    x: float
    y: float
    w: float
    h: float

    def to_dict(self) -> dict:
        return {
            "className": self.class_name,
            "confidence": round(self.confidence * 100, 2),
            "x": round(self.x, 6),
            "y": round(self.y, 6),
            "w": round(self.w, 6),
            "h": round(self.h, 6),
        }


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

    def _preprocess(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, float, float]:
        h, w = frame_bgr.shape[:2]
        img = cv2.resize(frame_bgr, (self.input_size, self.input_size))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)
        return img, w, h

    def predict(self, frame_bgr: np.ndarray) -> list[Detection]:
        tensor, orig_w, orig_h = self._preprocess(frame_bgr)
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

        if len(boxes_xywh) == 0:
            return []

        scale_x = orig_w / self.input_size
        scale_y = orig_h / self.input_size
        cx = boxes_xywh[:, 0] * scale_x
        cy = boxes_xywh[:, 1] * scale_y
        bw = boxes_xywh[:, 2] * scale_x
        bh = boxes_xywh[:, 3] * scale_y
        x1 = cx - bw / 2
        y1 = cy - bh / 2
        x2 = cx + bw / 2
        y2 = cy + bh / 2
        boxes_xyxy = np.stack([x1, y1, x2, y2], axis=1)

        keep = _nms(boxes_xyxy, confidences, self.iou_threshold)
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
                )
            )
        return detections
