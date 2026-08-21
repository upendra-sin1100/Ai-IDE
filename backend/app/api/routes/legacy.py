from __future__ import annotations

import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, status


router = APIRouter(tags=["legacy"])


class TerminalRequest:
    def __init__(self, command: str) -> None:
        self.command = command



@router.post("/terminal/execute")
async def execute_terminal_command(request: dict) -> dict[str, str | int]:
    command = str(request.get("command", "")).strip()
    if not command:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Command is required.")

    try:
        result = subprocess.run(command, shell=True, cwd=Path.cwd(), capture_output=True, text=True, timeout=30)
        output = (result.stdout or "") + (result.stderr or "")
        return {"output": output or "(no output)", "status": "OK" if result.returncode == 0 else "Error", "returncode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"output": "❌ Command timed out after 30 seconds.", "status": "Error"}
    except Exception as exc:
        return {"output": f"❌ {exc}", "status": "Error"}
