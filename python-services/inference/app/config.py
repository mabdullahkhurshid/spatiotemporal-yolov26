from pathlib import Path

from pydantic import AliasChoices, Field
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

    # INFERENCE_* names are the ones documented in .env.example; bare names kept for compatibility.
    conf_threshold: float = Field(
        default=0.35, validation_alias=AliasChoices("INFERENCE_CONF_THRESHOLD", "CONF_THRESHOLD")
    )
    iou_threshold: float = Field(
        default=0.45, validation_alias=AliasChoices("INFERENCE_IOU_THRESHOLD", "IOU_THRESHOLD")
    )
    frame_interval_ms: int = Field(
        default=500, validation_alias=AliasChoices("INFERENCE_FRAME_INTERVAL_MS", "FRAME_INTERVAL_MS")
    )
    max_concurrent_cameras: int = Field(
        default=4,
        validation_alias=AliasChoices("INFERENCE_MAX_CONCURRENT_CAMERAS", "MAX_CONCURRENT_CAMERAS"),
    )

    min_consecutive: int = Field(
        default=3, validation_alias=AliasChoices("INFERENCE_MIN_CONSECUTIVE", "MIN_CONSECUTIVE")
    )
    incident_min_consecutive: int = Field(
        default=3,
        validation_alias=AliasChoices("INFERENCE_INCIDENT_MIN_CONSECUTIVE", "INCIDENT_MIN_CONSECUTIVE"),
    )
    alert_cooldown_ms: int = 60_000
    incident_end_silence_ms: int = 30_000

    camera_registry_poll_ms: int = 30_000

    alert_classes: str = "fire,smoke"

    # Explainer process (python -m app.xai.main). best.pt holds the same weights as best.onnx.
    xai_model_path: str = Field(
        default=str(_INFERENCE_ROOT / "weights" / "best.pt"), validation_alias="XAI_MODEL_PATH"
    )
    xai_risk_model_path: str = Field(
        default=str(_INFERENCE_ROOT / "weights" / "risk_model.joblib"), validation_alias="XAI_RISK_MODEL_PATH"
    )
    xai_poll_ms: int = Field(default=3000, validation_alias="XAI_POLL_MS")
    xai_torch_threads: int = Field(default=2, validation_alias="XAI_TORCH_THREADS")
    xai_max_targets: int = Field(default=3, validation_alias="XAI_MAX_TARGETS")
    # Retrain the false-alarm model from operator outcomes this often (0 = only on start-up / by hand).
    xai_retrain_hours: float = Field(default=24, validation_alias="XAI_RETRAIN_HOURS")
    xai_min_samples: int = Field(default=150, validation_alias="XAI_MIN_SAMPLES")
    xai_min_per_class: int = Field(default=30, validation_alias="XAI_MIN_PER_CLASS")


settings = Settings()
