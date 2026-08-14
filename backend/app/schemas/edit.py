from __future__ import annotations

from pydantic import BaseModel, Field


class EditRequest(BaseModel):
    prompt: str = Field(min_length=1, description="Instruction for AI edit or file creation")
    file_path: str | None = Field(default=None, description="Target file path relative to workspace root")
    current_code: str | None = Field(default=None, description="Existing file content if editing")
    model: str | None = None
    provider: str | None = None


class ProposedEdit(BaseModel):
    file_path: str
    content: str
    diff: str | None = None
    is_new_file: bool = False
