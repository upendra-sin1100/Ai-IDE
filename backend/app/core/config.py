from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any
import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AI IDE Copilot API"
    api_prefix: str = "/api"

    groq_api_key: str | None = None
    gemini_api_key: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    groq_api_url: str = "https://api.groq.com/openai/v1"
    gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta"

    default_provider: str = "gemini"
    default_model: str = "gemini-3.6-flash"
    thinking_model: str = "gemini-3.6-flash"
    coding_model: str = "gemini-3.6-flash"

    groq_models: list[str] | str = Field(
        default_factory=lambda: [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ]
    )
    gemini_models: list[str] | str = Field(
        default_factory=lambda: [
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
        ]
    )
    cors_origins: list[str] | str = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
        ]
    )
    workspace_dir: str = str(Path(__file__).resolve().parents[2])

    @field_validator("groq_models", "gemini_models", "cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            val = value.strip()
            if val.startswith("[") and val.endswith("]"):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return parsed
                except Exception:
                    pass
            return [item.strip() for item in val.split(",") if item.strip()]
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


SettingsDependency = Annotated[Settings, Field(default_factory=get_settings)]
