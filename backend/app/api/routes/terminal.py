from fastapi import APIRouter, Depends, Query, WebSocket

from app.api.deps import get_workspace_service
from app.api.routes.auth import verify_token
from app.api.routes.auth import get_current_user
from app.services.workspace_service import WorkspaceService
from app.schemas.workspace import FileNode
from app.services.terminal_service import handle_terminal_websocket, handle_interactive_run_websocket
from app.core.config import get_settings

router = APIRouter(prefix="/terminal", tags=["terminal"])


@router.get("/tree", response_model=list[FileNode])
async def get_terminal_tree(
    path: str = Query("", description="Relative path in workspace root"),
    current_user: dict = Depends(get_current_user),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> list[FileNode]:
    return workspace_service.get_tree(path)


def _origin_allowed(websocket: WebSocket, settings) -> bool:
    origin = websocket.headers.get("origin")
    return not origin or origin in settings.cors_origins

@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket):
    settings = get_settings()
    await websocket.accept()
    if not _origin_allowed(websocket, settings):
        await websocket.close(code=1008)
        return
    try:
        await verify_token(websocket.query_params.get("access_token", ""), settings)
    except Exception:
        await websocket.close(code=1008)
        return

    # Fallback to current working directory if workspace_dir isn't configured
    workspace_dir = getattr(settings, "workspace_dir", ".")
    await handle_terminal_websocket(websocket, workspace_dir)

@router.websocket("/run_ws")
async def interactive_run_websocket(websocket: WebSocket):
    settings = get_settings()
    await websocket.accept()
    if not _origin_allowed(websocket, settings):
        await websocket.close(code=1008)
        return
    try:
        await verify_token(websocket.query_params.get("access_token", ""), settings)
    except Exception:
        await websocket.close(code=1008)
        return

    workspace_dir = getattr(settings, "workspace_dir", ".")
    await handle_interactive_run_websocket(websocket, workspace_dir)