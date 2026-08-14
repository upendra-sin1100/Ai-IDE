from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import ensure_model_allowed, get_app_settings, get_llm_service
from app.core.config import Settings
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_provider import LLMProvider
from app.utils.sse import format_sse

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat_standard(
    request: ChatRequest,
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
) -> ChatResponse:
    ensure_model_allowed(request.provider, request.model, settings)
    messages = [message.model_dump() for message in request.messages]
    content = await llm_service.complete("\n".join(m.get("content", "") for m in messages), request.model)
    return ChatResponse(content=content)


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
) -> StreamingResponse:
    ensure_model_allowed(request.provider, request.model, settings)

    async def event_generator() -> AsyncIterator[str]:
        try:
            messages = [message.model_dump() for message in request.messages]
            async for event in llm_service.astream_chat(messages, request.model):
                yield format_sse(event)
            yield format_sse({"type": "done", "delta": ""})
        except Exception as exc:
            yield format_sse({"type": "error", "delta": str(exc)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")
