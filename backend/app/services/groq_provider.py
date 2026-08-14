from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import Settings
from app.services.llm_provider import LLMProvider


class GroqProvider(LLMProvider):
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @property
    def name(self) -> str:
        return "groq"

    def _headers(self) -> dict[str, str]:
        if not self._settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        return {
            "Authorization": f"Bearer {self._settings.groq_api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

    async def _post_with_retry(self, path: str, payload: dict[str, object], stream: bool = False) -> httpx.Response:
        backoff = 0.5
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                if stream:
                    response = await self._client.post(path, headers=self._headers(), json=payload)
                else:
                    response = await self._client.post(path, headers=self._headers(), json=payload)
                response.raise_for_status()
                return response
            except (httpx.HTTPError, RuntimeError) as exc:
                last_error = exc
                if attempt == 1:
                    break
                await asyncio.sleep(backoff)
                backoff *= 2
        assert last_error is not None
        raise last_error

    async def astream_chat(self, messages: list[dict[str, str]], model: str | None = None) -> AsyncIterator[dict[str, str]]:
        payload = {"model": model or self._settings.default_model, "messages": messages, "stream": True}
        response = await self._post_with_retry("/chat/completions", payload, stream=True)
        async for raw_line in response.aiter_lines():
            line = raw_line.strip()
            if not line or line == "[DONE]":
                continue
            if line.startswith("data:"):
                line = line[5:].strip()
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                yield {"type": "message", "delta": line}
                continue

            choices = data.get("choices") if isinstance(data, dict) else None
            if choices:
                delta = choices[0].get("delta", {}) if isinstance(choices[0], dict) else {}
                if isinstance(delta, dict):
                    reasoning = delta.get("reasoning_content") or ""
                    content = delta.get("content") or ""
                    if reasoning:
                        yield {"type": "thinking", "delta": reasoning}
                    if content:
                        yield {"type": "message", "delta": content}
                    continue
            text = data.get("text") or data.get("content") or data.get("output") if isinstance(data, dict) else None
            if text:
                yield {"type": "message", "delta": str(text)}

    async def complete(self, prompt: str, model: str | None = None) -> str:
        payload = {"model": model or self._settings.default_model, "messages": [{"role": "user", "content": prompt}], "stream": False}
        response = await self._post_with_retry("/chat/completions", payload)
        data = response.json()
        if isinstance(data, dict) and data.get("choices"):
            choice = data["choices"][0]
            message = choice.get("message", {}) if isinstance(choice, dict) else {}
            if isinstance(message, dict) and message.get("content"):
                return str(message["content"])
            if isinstance(choice, dict) and choice.get("text"):
                return str(choice["text"])
        return json.dumps(data)
