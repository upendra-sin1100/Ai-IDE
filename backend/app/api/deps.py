from __future__ import annotations

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.services.llm_provider import LLMProvider
from app.services.provider_factory import get_provider
from app.services.workspace_service import WorkspaceService


def get_app_settings() -> Settings:
    return get_settings()


def get_gemini_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.gemini_client


async def get_workspace_service(
    settings: Settings = Depends(get_app_settings),
    request: Request = None,
) -> WorkspaceService:
    from app.api.routes.auth import get_current_user

    # Resolve auth here to avoid a module import cycle between auth and dependencies.
    current_user = await get_current_user(request, settings)
    access_token = request.headers.get("Authorization", "").split(" ", 1)[-1]
    return WorkspaceService(settings, user_id=current_user["id"], access_token=access_token)


def get_llm_service(
    provider_name: str | None = None,
    settings: Settings = Depends(get_app_settings),
    gemini_client: httpx.AsyncClient = Depends(get_gemini_client),
) -> LLMProvider:
    return get_provider(provider_name, settings, gemini_client)


def ensure_model_allowed(provider: str | None, model: str | None, settings: Settings) -> None:
    if provider and provider.lower() != "gemini":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider. Only Gemini is currently supported.")
    if model:
        allowed = set(settings.gemini_models)
        if model not in allowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Model '{model}' not allowed.")
