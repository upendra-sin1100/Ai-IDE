from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect


class TerminalSession:
    def __init__(self, workspace_dir: str) -> None:
        self.workspace_dir = workspace_dir
        self.process: Optional[asyncio.subprocess.Process] = None

    async def start(self) -> None:
        shell = "powershell.exe" if sys.platform == "win32" else os.getenv("SHELL", "/bin/bash")
        cwd = self.workspace_dir if os.path.exists(self.workspace_dir) else os.getcwd()

        try:
            self.process = await asyncio.create_subprocess_exec(
                shell,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=cwd,
            )
        except Exception as exc:
            # Fallback for Windows if powershell is missing
            if sys.platform == "win32":
                self.process = await asyncio.create_subprocess_exec(
                    "cmd.exe",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=cwd,
                )
            else:
                raise exc

    async def read_output(self, websocket: WebSocket) -> None:
        if not self.process or not self.process.stdout:
            return

        while self.process.returncode is None:
            try:
                # Read chunks of data
                data = await self.process.stdout.read(1024)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                await websocket.send_text(text)
            except Exception:
                break

    async def write_input(self, data: str) -> None:
        if self.process and self.process.stdin:
            try:
                self.process.stdin.write(data.encode("utf-8"))
                await self.process.stdin.drain()
            except Exception:
                pass

    def stop(self) -> None:
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass


async def handle_terminal_websocket(websocket: WebSocket, workspace_dir: str) -> None:
    await websocket.accept()
    session = TerminalSession(workspace_dir)
    await session.start()

    read_task = asyncio.create_task(session.read_output(websocket))

    try:
        while True:
            data = await websocket.receive_text()
            await session.write_input(data)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        read_task.cancel()
        session.stop()
