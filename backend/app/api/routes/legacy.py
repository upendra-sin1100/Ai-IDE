from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, status


router = APIRouter(tags=["legacy"])


class RunRequest:
    def __init__(self, language: str, code: str) -> None:
        self.language = language
        self.code = code


class TerminalRequest:
    def __init__(self, command: str) -> None:
        self.command = command


@router.post("/run")
async def run_code(request: dict) -> dict[str, str]:
    lang = str(request.get("language", "")).lower()
    code = str(request.get("code", ""))

    try:
        if lang == "python":
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as handle:
                handle.write(code)
                temp_path = handle.name
            result = subprocess.run(["python", temp_path], capture_output=True, text=True, timeout=15, cwd=tempfile.gettempdir())
            os.unlink(temp_path)
        elif lang in {"javascript", "typescript"}:
            with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False, encoding="utf-8") as handle:
                handle.write(code.replace("export default ", "// ").replace("export ", "// "))
                temp_path = handle.name
            result = subprocess.run(["node", temp_path], capture_output=True, text=True, timeout=15, cwd=tempfile.gettempdir())
            os.unlink(temp_path)
        else:
            return {"output": f"❌ {lang} not supported.", "status": "Error"}

        output = (result.stdout or "") + (result.stderr or "") or "(no output)"
        return {"output": output.strip(), "status": "OK" if result.returncode == 0 else "Error"}
    except subprocess.TimeoutExpired:
        return {"output": "❌ Timed out after 15 seconds.", "status": "Error"}
    except FileNotFoundError as exc:
        return {"output": f"❌ Runtime not found: {exc}", "status": "Error"}


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
