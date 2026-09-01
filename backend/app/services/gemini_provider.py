from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from fastapi import HTTPException

import httpx

from app.core.config import Settings
from app.schemas.edit import ProposedEdit
from app.services.llm_provider import LLMProvider


class GeminiProvider(LLMProvider):
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @property
    def name(self) -> str:
        return "gemini"

    def _check_api_key(self) -> None:
        if not self._settings.gemini_api_key:
            raise HTTPException(
                status_code=401,
                detail="GEMINI_API_KEY is not configured. Set GEMINI_API_KEY environment variable."
            )

    def _get_headers(self) -> dict[str, str]:
        """Get headers with Gemini API key for authentication."""
        return {
            "x-goog-api-key": self._settings.gemini_api_key,
            "Content-Type": "application/json"
        }

    def _normalize_api_url(self) -> str:
        """
        Normalize the API URL by removing trailing slash.
        Supports configuration like: https://generativelanguage.googleapis.com/v1beta
        """
        base = self._settings.gemini_api_url.rstrip("/")
        if not base:
            return "https://generativelanguage.googleapis.com/v1beta"
        return base

    def _build_url(self, model: str | None, stream: bool = True) -> str:
        """Build the Gemini API endpoint URL."""
        self._check_api_key()
        selected_model = model or self._settings.coding_model
        base_url = self._normalize_api_url()
        endpoint = "streamGenerateContent" if stream else "generateContent"
        alt_param = "?alt=sse" if stream else ""
        return f"{base_url}/models/{selected_model}:{endpoint}{alt_param}"

    async def _post_with_retry(self, url: str, payload: dict[str, object], stream: bool = False) -> httpx.Response:
        """
        Execute POST request to Gemini API with retry logic.
        """
        backoff = 0.5
        last_error: Exception | None = None
        
        for attempt in range(2):
            try:
                headers = self._get_headers()
                
                if stream:
                    response = await self._client.post(url, json=payload, headers=headers, timeout=45.0)
                else:
                    response = await self._client.post(url, json=payload, headers=headers, timeout=30.0)
                
                if response.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Gemini API authentication failed. Check your GEMINI_API_KEY."
                    )
                elif response.status_code == 403:
                    raise HTTPException(
                        status_code=403,
                        detail="Gemini API access denied. Check your API key permissions."
                    )
                elif response.status_code == 404:
                    raise HTTPException(
                        status_code=404,
                        detail="The selected Gemini model was not found. Check your DEFAULT_MODEL, CODING_MODEL configuration."
                    )
                elif response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail="Gemini API rate limit reached. Please try again later."
                    )
                elif response.status_code >= 500:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Gemini API server error ({response.status_code}). Try again later."
                    )
                elif response.status_code >= 400:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Gemini API error {response.status_code}: {response.text[:200]}"
                    )
                
                return response
            except HTTPException:
                raise
            except Exception as exc:
                last_error = exc
                if attempt == 1:
                    break
                await asyncio.sleep(backoff)
                backoff *= 2
        
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to Gemini API: {str(last_error)}"
        )

    async def astream_chat(
        self, messages: list[dict[str, str]], model: str | None = None
    ) -> AsyncIterator[dict[str, str]]:
        gemini_messages = []
        for message in messages:
            role = "user" if message.get("role") == "user" else "model"
            gemini_messages.append({"role": role, "parts": [{"text": message.get("content", "")}]})

        payload = {
            "system_instruction": {
                "parts": [
                    {
                        "text": (
                            "You are a helpful, precise AI coding assistant inside an IDE. "
                            "When users ask for code changes, describe your changes clearly. "
                            "When you propose creating a new file, output the file action in this exact format:\n"
                            "<CREATE_FILE>\n"
                            "{\n"
                            '  "path": "relative/file/path.ext",\n'
                            '  "content": "file content here"\n'
                            "}\n"
                            "</CREATE_FILE>"
                        )
                    }
                ]
            },
            "contents": gemini_messages,
        }

        # FIX 1: Use _build_url with stream=True
        url = self._build_url(model, stream=True)
        headers = self._get_headers()
        
        try:
            # FIX 2: Pass headers to authenticate stream requests
            async with self._client.stream("POST", url, json=payload, headers=headers, timeout=45.0) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    yield {"type": "error", "delta": f"Gemini API Error {response.status_code}: {body.decode(errors='ignore')}"}
                    return

                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line or line == "[DONE]":
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if isinstance(data, dict) and data.get("candidates"):
                        first = data["candidates"][0]
                        content = first.get("content", {}) if isinstance(first, dict) else {}
                        parts = content.get("parts", []) if isinstance(content, dict) else []
                        if parts:
                            text = parts[0].get("text") if isinstance(parts[0], dict) else None
                            if text:
                                yield {"type": "message", "delta": str(text)}
        except Exception as exc:
            yield {"type": "error", "delta": f"Streaming error: {str(exc)}"}

    async def complete(self, prompt: str, model: str | None = None) -> str:
        payload = {
            "system_instruction": {
                "parts": [{"text": "You are a code completion engine. Return ONLY the code completion suffix, no markdown formatting, no explanations."}]
            },
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        }
        # FIX 3: Use _build_url with stream=False
        url = self._build_url(model, stream=False)
        response = await self._post_with_retry(url, payload)
        data = response.json()

        if isinstance(data, dict) and data.get("candidates"):
            first = data["candidates"][0]
            content = first.get("content", {}) if isinstance(first, dict) else {}
            parts = content.get("parts", []) if isinstance(content, dict) else []
            if parts:
                return str(parts[0].get("text", ""))
        return ""

    async def propose_edit(
        self,
        prompt: str,
        current_code: str | None = None,
        file_path: str | None = None,
        model: str | None = None,
    ) -> ProposedEdit:
        is_new = not file_path or current_code is None or current_code == ""
        target_path = file_path or "new_file.js"

        system_instruction = (
            "You are an AI code editor. Respond strictly with a JSON object with the following schema:\n"
            "{\n"
            '  "file_path": string,\n'
            '  "content": string (the complete updated or new code),\n'
            '  "diff": string (optional diff explanation or code block),\n'
            '  "is_new_file": boolean\n'
            "}\n"
            "Do NOT include markdown formatting backticks around the JSON string if possible, or output plain JSON."
        )

        user_content = f"Instruction: {prompt}\nTarget File: {target_path}\n"
        if current_code:
            user_content += f"\nCurrent Content:\n```\n{current_code}\n```\n"

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        }

        # FIX 4: Use _build_url with stream=False
        url = self._build_url(model, stream=False)
        response = await self._post_with_retry(url, payload)
        data = response.json()

        raw_text = ""
        if isinstance(data, dict) and data.get("candidates"):
            first = data["candidates"][0]
            content = first.get("content", {}) if isinstance(first, dict) else {}
            parts = content.get("parts", []) if isinstance(content, dict) else []
            if parts:
                raw_text = str(parts[0].get("text", ""))

        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            lines = clean_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()

        try:
            parsed = json.loads(clean_text)
            return ProposedEdit(
                file_path=parsed.get("file_path", target_path),
                content=parsed.get("content", raw_text),
                diff=parsed.get("diff"),
                is_new_file=parsed.get("is_new_file", is_new),
            )
        except Exception:
            return ProposedEdit(
                file_path=target_path,
                content=raw_text,
                diff=None,
                is_new_file=is_new,
            )