from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.edit import ProposedEdit


class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    async def astream_chat(
        self, messages: list[dict[str, str]], model: str | None = None
    ) -> AsyncIterator[dict[str, str]]:
        raise NotImplementedError

    @abstractmethod
    async def complete(self, prompt: str, model: str | None = None) -> str:
        raise NotImplementedError

    @abstractmethod
    async def propose_edit(
        self,
        prompt: str,
        current_code: str | None = None,
        file_path: str | None = None,
        model: str | None = None,
    ) -> ProposedEdit:
        raise NotImplementedError
