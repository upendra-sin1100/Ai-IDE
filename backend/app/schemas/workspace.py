from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class FileNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: Optional[list[FileNode]] = None


class FileContent(BaseModel):
    path: str
    content: str


class WriteFileRequest(BaseModel):
    path: str
    content: str


class CreateFileRequest(BaseModel):
    path: str
    is_dir: bool = False


class RenameRequest(BaseModel):
    old_path: str
    new_path: str
