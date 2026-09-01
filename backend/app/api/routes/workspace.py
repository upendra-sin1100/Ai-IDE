from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_workspace_service
from app.api.routes.auth import get_current_user
from app.schemas.workspace import (
    CreateFileRequest,
    FileContent,
    FileNode,
    RenameRequest,
    WriteFileRequest,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/tree", response_model=list[FileNode])
async def get_tree(
    path: str = Query("", description="Relative path in workspace root"),
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> list[FileNode]:
    return workspace_service.get_tree(path)


@router.get("/file", response_model=FileContent)
async def read_file(
    path: str = Query(..., description="Relative file path"),
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> FileContent:
    return workspace_service.read_file(path)


@router.put("/file", response_model=FileContent)
async def write_file(
    req: WriteFileRequest,
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> FileContent:
    return workspace_service.write_file(req.path, req.content)


@router.post("/file", response_model=FileNode)
async def create_file(
    req: CreateFileRequest,
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> FileNode:
    return workspace_service.create_file_or_dir(req.path, req.is_dir)


@router.delete("/file")
async def delete_file(
    path: str = Query(..., description="Relative file or directory path"),
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> dict[str, bool]:
    success = workspace_service.delete_file_or_dir(path)
    return {"success": success}


@router.post("/rename", response_model=FileNode)
async def rename_file(
    req: RenameRequest,
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> FileNode:
    return workspace_service.rename_file_or_dir(req.old_path, req.new_path)
