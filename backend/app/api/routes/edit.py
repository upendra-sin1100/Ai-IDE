from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import ensure_model_allowed, get_app_settings, get_llm_service
from app.core.config import Settings
from app.schemas.edit import EditRequest, ProposedEdit
from app.services.llm_provider import LLMProvider

router = APIRouter(tags=["edit"])


@router.post("/edit", response_model=ProposedEdit)
async def request_proposed_edit(
    request: EditRequest,
    settings: Settings = Depends(get_app_settings),
    llm_service: LLMProvider = Depends(get_llm_service),
) -> ProposedEdit:
    """
    Generates an AI-proposed code edit or new file.
    CRITICAL: The backend NEVER writes content to disk here.
    It returns a ProposedEdit object to the frontend for user review.
    """
    ensure_model_allowed(request.provider, request.model, settings)
    proposed = await llm_service.propose_edit(
        prompt=request.prompt,
        current_code=request.current_code,
        file_path=request.file_path,
        model=request.model,
    )
    return proposed
