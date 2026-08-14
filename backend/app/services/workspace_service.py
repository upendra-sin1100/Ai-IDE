from __future__ import annotations

import os
import shutil
from pathlib import Path
from fastapi import HTTPException

from app.core.config import Settings
from app.schemas.workspace import FileContent, FileNode

IGNORED_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".pytest_cache", ".gemini", "dist", "build"}
IGNORED_FILES = {".DS_Store", "desktop.ini"}


class WorkspaceService:
    def __init__(self, settings: Settings) -> None:
        self.workspace_root = Path(settings.workspace_dir).resolve()
        if not self.workspace_root.exists():
            self.workspace_root.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, relative_path: str) -> Path:
        """
        Resolves path against workspace_root and ensures it cannot escape workspace_root.
        Prevents path traversal vulnerabilities.
        """
        if not relative_path:
            return self.workspace_root

        # Normalize separators and strip leading slashes
        clean_path = relative_path.replace("\\", "/").lstrip("/")
        target_path = (self.workspace_root / clean_path).resolve()

        try:
            target_path.relative_to(self.workspace_root)
        except ValueError:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: '{relative_path}' escapes workspace root."
            )

        return target_path

    def _relative_str(self, path: Path) -> str:
        try:
            rel = path.relative_to(self.workspace_root)
            return rel.as_posix()
        except ValueError:
            return path.as_posix()

    def get_tree(self, path: str = "") -> list[FileNode]:
        target_dir = self._resolve_path(path)
        if not target_dir.is_dir():
            raise HTTPException(status_code=400, detail=f"'{path}' is not a directory.")

        return self._build_node_list(target_dir)

    def _build_node_list(self, current_dir: Path) -> list[FileNode]:
        nodes: list[FileNode] = []
        try:
            entries = sorted(list(current_dir.iterdir()), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return nodes

        for entry in entries:
            name = entry.name
            if entry.is_dir():
                if name in IGNORED_DIRS:
                    continue
                nodes.append(
                    FileNode(
                        name=name,
                        path=self._relative_str(entry),
                        is_dir=True,
                        children=self._build_node_list(entry),
                    )
                )
            else:
                if name in IGNORED_FILES:
                    continue
                nodes.append(
                    FileNode(
                        name=name,
                        path=self._relative_str(entry),
                        is_dir=False,
                        children=None,
                    )
                )
        return nodes

    def read_file(self, path: str) -> FileContent:
        target_path = self._resolve_path(path)
        if not target_path.exists() or not target_path.is_file():
            raise HTTPException(status_code=404, detail=f"File '{path}' not found.")

        try:
            content = target_path.read_text(encoding="utf-8", errors="replace")
            return FileContent(path=self._relative_str(target_path), content=content)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error reading file '{path}': {str(exc)}")

    def write_file(self, path: str, content: str) -> FileContent:
        target_path = self._resolve_path(path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            target_path.write_text(content, encoding="utf-8")
            return FileContent(path=self._relative_str(target_path), content=content)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error writing to file '{path}': {str(exc)}")

    def create_file_or_dir(self, path: str, is_dir: bool = False) -> FileNode:
        target_path = self._resolve_path(path)
        if target_path.exists():
            raise HTTPException(status_code=400, detail=f"Path '{path}' already exists.")

        try:
            if is_dir:
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                target_path.touch()

            return FileNode(
                name=target_path.name,
                path=self._relative_str(target_path),
                is_dir=is_dir,
                children=[] if is_dir else None,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error creating '{path}': {str(exc)}")

    def delete_file_or_dir(self, path: str) -> bool:
        target_path = self._resolve_path(path)
        if target_path == self.workspace_root:
            raise HTTPException(status_code=400, detail="Cannot delete workspace root directory.")

        if not target_path.exists():
            raise HTTPException(status_code=404, detail=f"Path '{path}' not found.")

        try:
            if target_path.is_dir():
                shutil.rmtree(target_path)
            else:
                target_path.unlink()
            return True
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error deleting '{path}': {str(exc)}")

    def rename_file_or_dir(self, old_path: str, new_path: str) -> FileNode:
        old_target = self._resolve_path(old_path)
        new_target = self._resolve_path(new_path)

        if not old_target.exists():
            raise HTTPException(status_code=404, detail=f"Path '{old_path}' not found.")
        if new_target.exists():
            raise HTTPException(status_code=400, detail=f"Target path '{new_path}' already exists.")

        try:
            new_target.parent.mkdir(parents=True, exist_ok=True)
            old_target.rename(new_target)
            is_dir = new_target.is_dir()
            return FileNode(
                name=new_target.name,
                path=self._relative_str(new_target),
                is_dir=is_dir,
                children=self._build_node_list(new_target) if is_dir else None,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error renaming '{old_path}' to '{new_path}': {str(exc)}")
