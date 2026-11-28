"""LayerCAM heatmaps for YOLO detections (Grad-CAM family).

Vanilla Grad-CAM (channel-averaged gradients on the neck) mostly highlights background on this model.
LayerCAM weights each activation by its own positive gradient, which keeps the map on the object. The
target is the class score summed over every anchor that predicts the alert box (IoU > 0.5), and the
activations are the first block of the Detect classification branch at each scale.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from app.model.yolo_onnx import letterbox

logger = logging.getLogger(__name__)

ALERT_CLASSES = ("fire", "smoke")
TARGET_IOU = 0.5
PARITY_TOLERANCE = 1e-3


@dataclass
class CamTarget:
    box_index: int
    class_name: str
    confidence: float
    focus_in_box: float
    peak: tuple[float, float]

    def to_dict(self) -> dict:
        return {
            "boxIndex": self.box_index,
            "className": self.class_name,
            "confidence": round(float(self.confidence), 2),
            "focusInBox": round(float(self.focus_in_box), 4),
            "peak": {"x": round(float(self.peak[0]), 4), "y": round(float(self.peak[1]), 4)},
        }


def _iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    x0 = np.maximum(boxes[:, 0], box[0])
    y0 = np.maximum(boxes[:, 1], box[1])
    x1 = np.minimum(boxes[:, 2], box[2])
    y1 = np.minimum(boxes[:, 3], box[3])
    inter = np.clip(x1 - x0, 0, None) * np.clip(y1 - y0, 0, None)
    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    area = (box[2] - box[0]) * (box[3] - box[1])
    return inter / (areas + area - inter + 1e-6)


def _normalize(cam: np.ndarray) -> np.ndarray:
    lo, hi = float(cam.min()), float(cam.max())
    return (cam - lo) / (hi - lo) if hi > lo else np.zeros_like(cam)


def focus_in_box(cam: np.ndarray, box: tuple[int, int, int, int]) -> float:
    """Share of the heatmap's total attention that falls inside the box (pixels)."""
    x0, y0, x1, y1 = box
    total = float(cam.sum())
    return float(cam[y0:y1, x0:x1].sum()) / total if total > 0 else 0.0


class LayerCamExplainer:
    def __init__(self, weights_path: str, input_size: int = 960, threads: int = 2):
        import torch  # explainer-only dependency (requirements-xai.txt)

        self.torch = torch
        torch.set_num_threads(max(1, threads))
        # best.pt is a trusted local Ultralytics checkpoint; unpickling it needs the ultralytics package.
        ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)
        model = (ckpt.get("ema") or ckpt["model"]).float().eval()
        for p in model.parameters():
            p.requires_grad_(False)
        head = model.model[-1]
        # The ONNX export (end2end=False) runs the one-to-many branch; explain the same outputs.
        head.end2end = False
        self.model = model
        self.layers = [branch[0] for branch in head.cv3]
        names = model.names
        self.class_names = [str(names[k]) for k in sorted(names)] if isinstance(names, dict) else list(names)
        self.input_size = input_size

    def _tensor(self, frame_bgr: np.ndarray):
        img, ratio, pad_left, pad_top = letterbox(frame_bgr, self.input_size)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        x = self.torch.from_numpy(np.ascontiguousarray(img.transpose(2, 0, 1)))[None]
        return x, ratio, pad_left, pad_top

    def _forward(self, x):
        out = self.model(x)
        return out[0] if isinstance(out, (list, tuple)) else out

    def verify_parity(self, onnx_session) -> float:
        """Max class-score difference between best.pt and best.onnx on a fixed input; raises on mismatch."""
        rng = np.random.default_rng(0)
        x = rng.random((1, 3, self.input_size, self.input_size), dtype=np.float32)
        with self.torch.no_grad():
            ours = self._forward(self.torch.from_numpy(x)).numpy()
        theirs = onnx_session.run(None, {onnx_session.get_inputs()[0].name: x})[0]
        if ours.shape != theirs.shape:
            raise RuntimeError(f"best.pt output {ours.shape} differs from best.onnx {theirs.shape}")
        diff = float(np.abs(ours[:, 4:] - theirs[:, 4:]).max())
        if diff > PARITY_TOLERANCE:
            raise RuntimeError(f"best.pt and best.onnx disagree (max class score difference {diff:.2e})")
        return diff

    def explain(self, frame_bgr: np.ndarray, boxes: list[dict], max_targets: int = 3) -> tuple[np.ndarray | None, list[CamTarget]]:
        """Heatmap (H×W, 0–1) over the frame for the strongest fire/smoke boxes, plus per-box focus."""
        torch = self.torch
        chosen = sorted(
            ((i, b) for i, b in enumerate(boxes) if b.get("className") in ALERT_CLASSES and b.get("className") in self.class_names),
            key=lambda item: -float(item[1].get("confidence") or 0),
        )[:max_targets]
        if not chosen:
            return None, []

        h, w = frame_bgr.shape[:2]
        x, ratio, pad_left, pad_top = self._tensor(frame_bgr)
        x.requires_grad_(True)
        acts: list = []

        def keep(_module, _inputs, output):
            output.retain_grad()
            acts.append(output)

        hooks = [layer.register_forward_hook(keep) for layer in self.layers]
        try:
            with torch.enable_grad():
                pred = self._forward(x)[0]
        finally:
            for hook in hooks:
                hook.remove()

        raw = pred.detach().numpy()
        cx, cy, bw, bh = raw[0], raw[1], raw[2], raw[3]
        anchors = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], axis=1)
        new_h, new_w = round(h * ratio), round(w * ratio)

        combined = np.zeros((h, w), dtype=np.float32)
        targets: list[CamTarget] = []
        for n, (index, box) in enumerate(chosen):
            cls = self.class_names.index(box["className"])
            bx0, by0 = box["x"] * w, box["y"] * h
            bx1, by1 = (box["x"] + box["w"]) * w, (box["y"] + box["h"]) * h
            letterboxed = np.array([bx0 * ratio + pad_left, by0 * ratio + pad_top, bx1 * ratio + pad_left, by1 * ratio + pad_top])
            ious = _iou(letterboxed, anchors)
            mask = ious > TARGET_IOU
            if not mask.any():
                mask = ious == ious.max()
            score = (pred[4 + cls] * torch.from_numpy(mask.astype(np.float32))).sum()

            for act in acts:
                act.grad = None
            score.backward(retain_graph=n < len(chosen) - 1)

            cam = np.zeros((self.input_size, self.input_size), dtype=np.float32)
            for act in acts:
                layer_cam = torch.relu((torch.relu(act.grad) * act).sum(1))[0].detach().numpy()
                peak = layer_cam.max()
                if peak > 0:
                    cam += cv2.resize(layer_cam / peak, (self.input_size, self.input_size), interpolation=cv2.INTER_LINEAR)
            cam = cam[pad_top : pad_top + new_h, pad_left : pad_left + new_w]
            cam = _normalize(cv2.resize(cam, (w, h), interpolation=cv2.INTER_LINEAR))

            pixel_box = (int(bx0), int(by0), max(int(bx0) + 1, int(round(bx1))), max(int(by0) + 1, int(round(by1))))
            py, px = np.unravel_index(int(cam.argmax()), cam.shape)
            targets.append(
                CamTarget(
                    box_index=index,
                    class_name=box["className"],
                    confidence=float(box.get("confidence") or 0),
                    focus_in_box=focus_in_box(cam, pixel_box),
                    peak=(px / w, py / h),
                )
            )
            combined = np.maximum(combined, cam)
        return combined, targets


def render_overlay(frame_bgr: np.ndarray, cam: np.ndarray, boxes: list[dict], targets: list[CamTarget], quality: int = 85) -> bytes:
    """Heatmap blended over the frame with the explained boxes outlined, as JPEG bytes."""
    h, w = frame_bgr.shape[:2]
    heat = cv2.applyColorMap((np.clip(cam, 0, 1) * 255).astype(np.uint8), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(frame_bgr, 0.55, heat, 0.45, 0)
    thickness = max(2, round(min(h, w) / 300))
    for target in targets:
        b = boxes[target.box_index]
        p0 = (int(b["x"] * w), int(b["y"] * h))
        p1 = (int((b["x"] + b["w"]) * w), int((b["y"] + b["h"]) * h))
        cv2.rectangle(overlay, p0, p1, (255, 255, 255), thickness)
        label = f"{target.class_name} {target.confidence:.0f}% | focus {target.focus_in_box * 100:.0f}%"
        scale = max(0.45, min(h, w) / 900)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        ty = max(th + 6, p0[1])
        cv2.rectangle(overlay, (p0[0], ty - th - 6), (p0[0] + tw + 8, ty), (255, 255, 255), -1)
        cv2.putText(overlay, label, (p0[0] + 4, ty - 4), cv2.FONT_HERSHEY_SIMPLEX, scale, (20, 20, 20), 1, cv2.LINE_AA)
    ok, buf = cv2.imencode(".jpg", overlay, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Could not encode heatmap overlay")
    return buf.tobytes()
