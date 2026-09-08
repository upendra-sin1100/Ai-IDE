from __future__ import annotations

import os
import shutil
from pathlib import Path
from fastapi import HTTPException
import httpx

from app.core.config import Settings
from app.schemas.workspace import FileContent, FileNode

IGNORED_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".pytest_cache", ".gemini", "dist", "build"}
IGNORED_FILES = {".DS_Store", "desktop.ini"}


class WorkspaceService:
    def __init__(
        self,
        settings: Settings,
        user_id: str | None = None,
        access_token: str | None = None,
    ) -> None:
        self.user_id = user_id
        self.access_token = access_token
        self.storage_url = (
            f"{settings.supabase_url.rstrip('/')}/rest/v1/workspace_files"
            if settings.supabase_url and settings.supabase_anon_key
            else None
        )
        self.storage_headers = {
            "apikey": settings.supabase_anon_key or "",
            "Authorization": f"Bearer {access_token or ''}",
            "Content-Type": "application/json",
        }
        self.workspace_root = Path(settings.workspace_dir).resolve()
        if not self.workspace_root.exists():
            self.workspace_root.mkdir(parents=True, exist_ok=True)

    @property
    def uses_remote_storage(self) -> bool:
        return bool(self.storage_url and self.user_id and self.access_token)

    def _storage_request(self, method: str, headers: dict | None = None, **kwargs) -> httpx.Response:
        if not self.uses_remote_storage:
            raise RuntimeError("Remote workspace storage is not configured")
        try:
            response = httpx.request(
                method,
                self.storage_url,
                headers=headers or self.storage_headers,
                timeout=15.0,
                **kwargs,
            )
            response.raise_for_status()
            return response
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Supabase workspace storage error: {exc}") from exc

    def _remote_rows(self) -> list[dict]:
        response = self._storage_request(
            "GET",
            params={"select": "path,is_dir", "user_id": f"eq.{self.user_id}", "order": "path"},
        )
        return response.json()

    def _remote_file(self, path: str) -> dict | None:
        response = self._storage_request(
            "GET",
            params={"select": "path,content,is_dir", "user_id": f"eq.{self.user_id}", "path": f"eq.{path}"},
        )
        rows = response.json()
        return rows[0] if rows else None

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
        if self.uses_remote_storage:
            return self._get_remote_tree(path)
        target_dir = self._resolve_path(path)
        if not target_dir.is_dir():
            raise HTTPException(status_code=400, detail=f"'{path}' is not a directory.")

        return self._build_node_list(target_dir)

    def _get_remote_tree(self, path: str) -> list[FileNode]:
        self._resolve_path(path)
        prefix = f"{path.strip('/')}/" if path.strip('/') else ""
        nodes: dict[str, FileNode] = {}
        for row in self._remote_rows():
            row_path = row["path"]
            if not row_path.startswith(prefix):
                continue
            remainder = row_path[len(prefix):]
            if not remainder or "/" in remainder:
                continue
            nodes[remainder] = FileNode(
                name=remainder,
                path=f"{prefix}{remainder}",
                is_dir=row["is_dir"],
                children=[] if row["is_dir"] else None,
            )
        return sorted(nodes.values(), key=lambda node: (not node.is_dir, node.name.lower()))

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
        if self.uses_remote_storage:
            row = self._remote_file(path)
            if not row or row["is_dir"]:
                raise HTTPException(status_code=404, detail=f"File '{path}' not found.")
            return FileContent(path=row["path"], content=row.get("content") or "")
        target_path = self._resolve_path(path)
        if not target_path.exists() or not target_path.is_file():
            raise HTTPException(status_code=404, detail=f"File '{path}' not found.")

        try:
            content = target_path.read_text(encoding="utf-8", errors="replace")
            return FileContent(path=self._relative_str(target_path), content=content)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error reading file '{path}': {str(exc)}")

    def write_file(self, path: str, content: str) -> FileContent:
        if self.uses_remote_storage:
            self._resolve_path(path)
            self._storage_request(
                "POST",
                params={"on_conflict": "user_id,path"},
                headers={**self.storage_headers, "Prefer": "resolution=merge-duplicates"},
                json={"user_id": self.user_id, "path": path.replace("\\", "/").lstrip("/"), "content": content, "is_dir": False},
            )
            return FileContent(path=path, content=content)
        target_path = self._resolve_path(path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            target_path.write_text(content, encoding="utf-8")
            return FileContent(path=self._relative_str(target_path), content=content)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error writing to file '{path}': {str(exc)}")

    def create_file_or_dir(self, path: str, is_dir: bool = False) -> FileNode:
        if self.uses_remote_storage:
            normalized_path = path.replace("\\", "/").lstrip("/")
            self._resolve_path(normalized_path)
            if self._remote_file(normalized_path):
                raise HTTPException(status_code=400, detail=f"Path '{path}' already exists.")
            self._storage_request(
                "POST",
                json={"user_id": self.user_id, "path": normalized_path, "content": "", "is_dir": is_dir},
            )
            return FileNode(name=Path(normalized_path).name, path=normalized_path, is_dir=is_dir, children=[] if is_dir else None)
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
        if self.uses_remote_storage:
            normalized_path = path.replace("\\", "/").strip("/")
            self._resolve_path(normalized_path)
            row = self._remote_file(normalized_path)
            if not row:
                raise HTTPException(status_code=404, detail=f"Path '{path}' not found.")
            params = {"user_id": f"eq.{self.user_id}"}
            params.update({"or": f"(path.eq.{normalized_path},path.like.{normalized_path}/*)"} if row["is_dir"] else {"path": f"eq.{normalized_path}"})
            self._storage_request("DELETE", params=params)
            return True
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
        if self.uses_remote_storage:
            old_normalized = old_path.replace("\\", "/").strip("/")
            new_normalized = new_path.replace("\\", "/").strip("/")
            self._resolve_path(old_normalized)
            self._resolve_path(new_normalized)
            row = self._remote_file(old_normalized)
            if not row:
                raise HTTPException(status_code=404, detail=f"File '{old_path}' not found.")
            rows = self._storage_request(
                "GET",
                params={"select": "path,content,is_dir", "user_id": f"eq.{self.user_id}", "path": f"like.{old_normalized}*"},
            ).json()
            for item in rows:
                replacement = new_normalized + item["path"][len(old_normalized):]
                self._storage_request("PATCH", params={"user_id": f"eq.{self.user_id}", "path": f"eq.{item['path']}"}, json={"path": replacement})
            return FileNode(name=Path(new_normalized).name, path=new_normalized, is_dir=row["is_dir"], children=[] if row["is_dir"] else None)
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
