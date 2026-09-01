from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import ensure_model_allowed, get_app_settings, get_llm_service
from app.api.routes.auth import get_current_user
from app.core.config import Settings
from app.schemas.completion import InlineCompletionRequest, InlineCompletionResponse
from app.services.llm_provider import LLMProvider

router = APIRouter(tags=["completion"])


@router.post("/complete")
async def request_inline_completion(
    request: InlineCompletionRequest,
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
) -> InlineCompletionResponse:
    ensure_model_allowed(request.provider, request.model, settings)
    prompt = f"Prefix:\n{request.prefix}\nSuffix:\n{request.suffix or ''}\nLanguage: {request.language or 'text'}\nProvide completion:"
    text = await llm_service.complete(prompt, request.model)
    return InlineCompletionResponse(text=text)
