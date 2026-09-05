from fastapi import APIRouter, WebSocket

from app.api.routes.auth import verify_token
from app.services.terminal_service import handle_terminal_websocket, handle_interactive_run_websocket
from app.core.config import get_settings

router = APIRouter(prefix="/terminal", tags=["terminal"])

@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket):
    settings = get_settings()
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
    try:
        await verify_token(websocket.query_params.get("access_token", ""), settings)
    except Exception:
        await websocket.close(code=1008)
        return

    workspace_dir = getattr(settings, "workspace_dir", ".")
    await handle_interactive_run_websocket(websocket, workspace_dir)