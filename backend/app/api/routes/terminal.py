from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket

from app.core.config import Settings, get_settings
from app.services.terminal_service import handle_terminal_websocket

router = APIRouter(prefix="/terminal", tags=["terminal"])


@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket, settings: Settings = Depends(get_settings)):
    """
    User-driven interactive terminal WebSocket.
    Note: AI has zero access to this terminal session.
    """
    await handle_terminal_websocket(websocket, settings.workspace_dir)
