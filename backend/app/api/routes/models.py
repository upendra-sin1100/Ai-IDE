from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.models import ModelInfo, ModelListResponse

router = APIRouter(tags=["models"])


@router.get("/models")
async def list_models(settings: Settings = Depends(get_app_settings)) -> ModelListResponse:
    models = [
        ModelInfo(id=m, provider="gemini", label=f"Gemini {m}") for m in settings.gemini_models
    ]
    return ModelListResponse(
        default_provider="gemini",
        default_model=settings.default_model,
        models=models,
    )
