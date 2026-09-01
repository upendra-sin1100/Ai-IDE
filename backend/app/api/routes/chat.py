from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import ensure_model_allowed, get_app_settings, get_llm_service, get_workspace_service
from app.api.routes.auth import get_current_user
from app.core.config import Settings
from app.schemas.chat import ChatRequest, ChatResponse, OpenFile
from app.services.llm_provider import LLMProvider
from app.services.workspace_service import WorkspaceService
from app.utils.sse import format_sse

router = APIRouter(tags=["chat"])


def format_open_files_context(
    open_files: list[OpenFile],
    active_file_path: str | None = None,
    max_budget_chars: int = 16000,
) -> str:
    if not open_files:
        return ""

    active_file_obj = None
    other_files: list[OpenFile] = []

    for f in open_files:
        if active_file_path and (f.path == active_file_path or f.path.endswith(active_file_path)):
            active_file_obj = f
        else:
            other_files.append(f)

    if not active_file_obj and open_files:
        active_file_obj = open_files[0]
        other_files = open_files[1:]

    remaining_budget = max_budget_chars

    # Always keep active file content
    active_content = active_file_obj.content if active_file_obj else ""
    if len(active_content) > remaining_budget:
        active_content = active_content[:remaining_budget] + "\n... [content truncated due to budget]"
    remaining_budget -= len(active_content)

    # Sort other files by size ascending to fit smaller files, dropping largest files first if budget is exceeded
    other_files_sorted = sorted(other_files, key=lambda f: len(f.content))
    kept_other_files: list[OpenFile] = []

    for f in other_files_sorted:
        if len(f.content) <= remaining_budget:
            kept_other_files.append(f)
            remaining_budget -= len(f.content)

    final_files: list[OpenFile] = []
    if active_file_obj:
        final_files.append(OpenFile(path=active_file_obj.path, content=active_content))
    for f in other_files:
        if f in kept_other_files:
            final_files.append(f)

    blocks = ["Here are related files currently open in the user's workspace.\n"]
    for f in final_files:
        blocks.append(f"--- FILE: {f.path} ---\n{f.content}\n")

    return "\n".join(blocks).strip()


def parse_and_validate_create_file_actions(
    text: str, workspace_service: WorkspaceService
) -> list[dict]:
    actions = []
    pattern = r"<CREATE_FILE>\s*([\s\S]*?)\s*</CREATE_FILE>"
    matches = re.findall(pattern, text, re.IGNORECASE)

    for match in matches:
        try:
            data = json.loads(match.strip())
            file_path = data.get("path")
            content = data.get("content", "")

            if not file_path or not isinstance(file_path, str):
                continue

            # Validate path safety against workspace_root
            try:
                workspace_service._resolve_path(file_path)
            except Exception as exc:
                print(f"Path traversal check rejected path '{file_path}': {exc}")
                continue

            actions.append({
                "file_path": file_path,
                "content": content,
                "is_new_file": True,
            })
        except Exception as exc:
            print(f"Failed to parse <CREATE_FILE> block: {exc}")
            continue

    return actions


@router.post("/chat")
async def chat_standard(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> ChatResponse:
    ensure_model_allowed(request.provider, request.model, settings)
    context_str = format_open_files_context(request.open_files, active_file_path=request.active_file)
    messages = [message.model_dump() for message in request.messages]
    if context_str and messages:
        messages[-1]["content"] = f"[WORKSPACE CONTEXT]\n{context_str}\n\n[USER REQUEST]\n{messages[-1].get('content', '')}"

    content = await llm_service.complete("\n".join(m.get("content", "") for m in messages), request.model)
    actions = parse_and_validate_create_file_actions(content, workspace_service)
    return ChatResponse(content=content, proposed_edits=actions)


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> StreamingResponse:
    ensure_model_allowed(request.provider, request.model, settings)

    context_str = format_open_files_context(request.open_files, active_file_path=request.active_file)

    async def event_generator() -> AsyncIterator[str]:
        try:
            messages = [message.model_dump() for message in request.messages]

            if context_str and messages:
                ctx_msg = {
                    "role": "user",
                    "content": f"[WORKSPACE CONTEXT]\n{context_str}\n\n[USER REQUEST]\n{messages[-1].get('content', '')}"
                }
                messages[-1] = ctx_msg

            accumulated_text = ""
            async for event in llm_service.astream_chat(messages, request.model):
                if event.get("type") in ["message", "chunk"]:
                    accumulated_text += event.get("delta", "")
                yield format_sse(event)

            # Parse proposed create file actions from full response
            actions = parse_and_validate_create_file_actions(accumulated_text, workspace_service)
            for action in actions:
                yield format_sse({"type": "create_file", "action": action})

            yield format_sse({"type": "done", "delta": ""})
        except Exception as exc:
            yield format_sse({"type": "error", "delta": str(exc)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")
