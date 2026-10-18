import os
import unittest
from unittest import mock

from app.analytics.incident_tracker import IncidentTracker
from app.config import Settings

FIRE = {"className": "fire", "confidence": 88.0, "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
OTHER = {"className": "other", "confidence": 95.0, "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}


def make_tracker():
    return IncidentTracker(
        alert_classes={"fire", "smoke"},
        min_consecutive=3,
        alert_cooldown_ms=60_000,
        incident_end_silence_ms=30_000,
    )


class TrackerTests(unittest.TestCase):
    def test_alert_requires_consecutive_hits(self):
        t = make_tracker()
        now = 1_000_000
        self.assertNotIn("createAlert", t.update([FIRE], now))
        self.assertNotIn("createAlert", t.update([FIRE], now + 500))
        metrics = t.update([FIRE], now + 1000)
        self.assertTrue(metrics.get("createAlert"))
        self.assertEqual(metrics["fireConfidence"], 88.0)

    def test_gap_resets_consecutive_count(self):
        t = make_tracker()
        now = 1_000_000
        t.update([FIRE], now)
        t.update([FIRE], now + 500)
        t.update([], now + 1000)
        self.assertNotIn("createAlert", t.update([FIRE], now + 1500))

    def test_cooldown_suppresses_repeat_alerts(self):
        t = make_tracker()
        now = 1_000_000
        alerts = 0
        for i in range(20):
            if t.update([FIRE], now + i * 500).get("createAlert"):
                alerts += 1
        self.assertEqual(alerts, 1)
        later = t.update([FIRE], now + 61_000)
        self.assertTrue(later.get("createAlert"))

    def test_other_class_never_alerts(self):
        t = make_tracker()
        for i in range(10):
            self.assertNotIn("createAlert", t.update([OTHER], 1_000_000 + i * 500))

    def test_incident_ends_after_silence(self):
        t = make_tracker()
        now = 1_000_000
        for i in range(3):
            t.update([FIRE], now + i * 500)
        self.assertNotIn("incidentEnded", t.update([], now + 10_000))
        ended = t.update([], now + 32_000)
        self.assertTrue(ended.get("incidentEnded"))
        self.assertFalse(t.state.active)

    def test_single_frame_hit_does_not_open_an_incident(self):
        t = make_tracker()
        now = 1_000_000
        self.assertFalse(t.update([FIRE], now)["incidentActive"])
        t.update([], now + 500)
        self.assertFalse(t.update([FIRE], now + 1000)["incidentActive"])
        self.assertNotIn("incidentEnded", t.update([], now + 60_000))

    def test_incident_starts_at_first_frame_of_confirming_streak(self):
        t = make_tracker()
        now = 1_000_000
        t.update([FIRE], now)
        self.assertFalse(t.update([FIRE], now + 500)["incidentActive"])
        metrics = t.update([FIRE], now + 1000)
        self.assertTrue(metrics["incidentActive"])
        self.assertEqual(metrics["startedAt"], now)


class ConfigTests(unittest.TestCase):
    def test_documented_env_names_are_honoured(self):
        env = {
            "INFERENCE_FRAME_INTERVAL_MS": "250",
            "INFERENCE_MAX_CONCURRENT_CAMERAS": "9",
            "INFERENCE_CONF_THRESHOLD": "0.5",
            "INFERENCE_IOU_THRESHOLD": "0.6",
        }
        with mock.patch.dict(os.environ, env):
            s = Settings(_env_file=None)
        self.assertEqual(s.frame_interval_ms, 250)
        self.assertEqual(s.max_concurrent_cameras, 9)
        self.assertEqual(s.conf_threshold, 0.5)
        self.assertEqual(s.iou_threshold, 0.6)

    def test_defaults_without_env(self):
        keys = [k for k in os.environ if k.startswith("INFERENCE_") or k in {"FRAME_INTERVAL_MS", "CONF_THRESHOLD"}]
        with mock.patch.dict(os.environ, {}, clear=False):
            for k in keys:
                os.environ.pop(k, None)
            s = Settings(_env_file=None)
        self.assertEqual(s.frame_interval_ms, 500)
        self.assertEqual(s.conf_threshold, 0.35)


if __name__ == "__main__":
    unittest.main()
