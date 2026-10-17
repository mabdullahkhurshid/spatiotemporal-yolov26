from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_INFERENCE_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    backend_url: str = Field(default="http://localhost:5000", validation_alias="BACKEND_URL")
    inference_service_api_key: str = Field(
        default="change-me-inference-key", validation_alias="INFERENCE_SERVICE_API_KEY"
    )

    model_path: str = Field(
        default=str(_INFERENCE_ROOT / "weights" / "best.onnx"),
        validation_alias="INFERENCE_MODEL_PATH",
    )
    classes_path: str = str(_INFERENCE_ROOT / "config" / "classes.json")

    conf_threshold: float = 0.35
    iou_threshold: float = 0.45
    frame_interval_ms: int = 500
    max_concurrent_cameras: int = 4

    min_consecutive: int = 3
    alert_cooldown_ms: int = 60_000
    incident_end_silence_ms: int = 30_000

    camera_registry_poll_ms: int = 30_000

    alert_classes: str = "fire,smoke"


settings = Settings()
