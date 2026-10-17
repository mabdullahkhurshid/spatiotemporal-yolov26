from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class IncidentState:
    active: bool = False
    started_at_ms: int | None = None
    last_seen_at_ms: int | None = None
    consecutive: int = 0
    last_alert_at_ms: int = 0
    detection_timestamps: list[int] = field(default_factory=list)
    area_samples: list[dict] = field(default_factory=list)


class IncidentTracker:
    def __init__(
        self,
        alert_classes: set[str],
        min_consecutive: int,
        alert_cooldown_ms: int,
        incident_end_silence_ms: int,
    ):
        self.alert_classes = alert_classes
        self.min_consecutive = min_consecutive
        self.alert_cooldown_ms = alert_cooldown_ms
        self.incident_end_silence_ms = incident_end_silence_ms
        self.state = IncidentState()

    def _prune_timestamps(self, now_ms: int) -> None:
        cutoff = now_ms - 60_000
        self.state.detection_timestamps = [t for t in self.state.detection_timestamps if t >= cutoff]

    def _frequency_per_min(self, now_ms: int) -> float:
        self._prune_timestamps(now_ms)
        return float(len(self.state.detection_timestamps))

    def _total_area(self, detections: list[dict]) -> float:
        return sum(d.get("w", 0) * d.get("h", 0) for d in detections if d.get("className") in self.alert_classes)

    def _spread_rate(self) -> float:
        samples = self.state.area_samples[-20:]
        if len(samples) < 2:
            return 0.0
        t0 = samples[0]["t"]
        t1 = samples[-1]["t"]
        if t1 <= t0:
            return 0.0
        return (samples[-1]["area"] - samples[0]["area"]) / ((t1 - t0) / 1000.0)

    def _class_peaks(self, detections: list[dict]) -> tuple[float, float]:
        fire = max((d["confidence"] for d in detections if d.get("className") == "fire"), default=0.0)
        smoke = max((d["confidence"] for d in detections if d.get("className") == "smoke"), default=0.0)
        return fire, smoke

    def update(self, detections: list[dict], now_ms: int | None = None) -> dict:
        now_ms = now_ms or int(time.time() * 1000)
        alert_hits = [d for d in detections if d.get("className") in self.alert_classes]
        has_hit = len(alert_hits) > 0

        if has_hit:
            self.state.consecutive += 1
            self.state.last_seen_at_ms = now_ms
            if not self.state.active:
                self.state.active = True
                self.state.started_at_ms = now_ms
            self.state.detection_timestamps.append(now_ms)
            area = self._total_area(detections)
            self.state.area_samples.append({"t": now_ms, "area": area})
            if len(self.state.area_samples) > 120:
                self.state.area_samples = self.state.area_samples[-120:]
        else:
            self.state.consecutive = 0
            if (
                self.state.active
                and self.state.last_seen_at_ms
                and now_ms - self.state.last_seen_at_ms >= self.incident_end_silence_ms
            ):
                ended = {
                    "incidentEnded": True,
                    "startedAt": self.state.started_at_ms,
                    "endedAt": now_ms,
                }
                self.state = IncidentState()
                return ended

        fire_conf, smoke_conf = self._class_peaks(detections)
        metrics = {
            "incidentActive": self.state.active,
            "startedAt": self.state.started_at_ms,
            "lastSeenAt": self.state.last_seen_at_ms,
            "detectionFrequencyPerMin": self._frequency_per_min(now_ms),
            "estimatedSpreadRate": self._spread_rate(),
            "fireConfidence": fire_conf,
            "smokeConfidence": smoke_conf,
            "consecutive": self.state.consecutive,
        }

        should_alert = (
            has_hit
            and self.state.consecutive >= self.min_consecutive
            and now_ms - self.state.last_alert_at_ms >= self.alert_cooldown_ms
        )
        if should_alert:
            self.state.last_alert_at_ms = now_ms
            metrics["createAlert"] = True
            metrics["averageConfidence"] = max(fire_conf, smoke_conf)

        return metrics
