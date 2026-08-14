from __future__ import annotations

import httpx

from app.core.config import Settings
from app.services.gemini_provider import GeminiProvider
from app.services.llm_provider import LLMProvider


def get_provider(
    name: str | None,
    settings: Settings,
    gemini_client: httpx.AsyncClient,
) -> LLMProvider:
    """
    Factory function for obtaining an LLMProvider instance.
    Add future providers (e.g. Groq, Anthropic, OpenAI) here.
    """
    provider_name = (name or settings.default_provider).lower()
    if provider_name == "gemini":
        return GeminiProvider(gemini_client, settings)

    # Default to Gemini for now as specified
    return GeminiProvider(gemini_client, settings)
