from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect


async def _start_subprocess(command: list[str], *, cwd: str, env: Optional[dict[str, str]] = None) -> subprocess.Popen[bytes] | asyncio.subprocess.Process:
    try:
        return await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
            env=env,
        )
    except NotImplementedError:
        if sys.platform != "win32":
            raise
        return await asyncio.to_thread(
            lambda: subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=cwd,
                env=env,
            )
        )


class TerminalSession:
    def __init__(self, workspace_dir: str) -> None:
        self.workspace_dir = workspace_dir
        self.process: Optional[subprocess.Popen[bytes] | asyncio.subprocess.Process] = None

    async def start(self) -> None:
        shell = "powershell.exe" if sys.platform == "win32" else os.getenv("SHELL", "/bin/bash")
        cwd = self.workspace_dir if os.path.exists(self.workspace_dir) else os.getcwd()

        try:
            self.process = await _start_subprocess([shell], cwd=cwd)
        except Exception as exc:
            # Fallback for Windows if powershell is missing
            if sys.platform == "win32":
                self.process = await _start_subprocess(["cmd.exe"], cwd=cwd)
            else:
                raise exc

    async def read_output(self, websocket: WebSocket) -> None:
        if not self.process or not getattr(self.process, "stdout", None):
            return

        while True:
            try:
                if isinstance(self.process, asyncio.subprocess.Process):
                    should_continue = self.process.returncode is None
                    if not should_continue:
                        break
                    data = await self.process.stdout.read(1024)
                else:
                    data = await asyncio.to_thread(self.process.stdout.read, 1024)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                await websocket.send_text(text)
            except Exception:
                break

    async def write_input(self, data: str) -> None:
        if self.process and getattr(self.process, "stdin", None):
            try:
                if isinstance(self.process, asyncio.subprocess.Process):
                    self.process.stdin.write(data.encode("utf-8"))
                    await self.process.stdin.drain()
                else:
                    payload = data.encode("utf-8")
                    await asyncio.to_thread(self.process.stdin.write, payload)
                    await asyncio.to_thread(self.process.stdin.flush)
            except Exception:
                pass

    def stop(self) -> None:
        if self.process:
            try:
                if isinstance(self.process, asyncio.subprocess.Process):
                    if self.process.stdin:
                        self.process.stdin.close()
                    if self.process.returncode is None:
                        self.process.terminate()
                else:
                    if getattr(self.process, "stdin", None):
                        self.process.stdin.close()
                    self.process.terminate()
            except Exception:
                pass


async def handle_terminal_websocket(websocket: WebSocket, workspace_dir: str) -> None:
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


EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".cc": "cpp",
    ".c++": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".sh": "shell",
    ".bash": "shell",
}


def resolve_language(language: Optional[str] = None, file_name: str = "main.py") -> str:
    """
    Resolves execution language.
    `language` remains an optional override.
    If `language` is not provided, infers language from file extension of `file_name`.
    If extension is unsupported or missing, raises ValueError.
    """
    if language and language.strip():
        return language.strip().lower()

    if not file_name:
        raise ValueError("Either 'language' or 'file_name' with a valid extension must be provided.")

    ext = Path(file_name).suffix.lower()
    if not ext:
        raise ValueError(f"File '{file_name}' has no file extension to infer language from.")

    if ext in EXTENSION_TO_LANGUAGE:
        return EXTENSION_TO_LANGUAGE[ext]

    raise ValueError(f"Unsupported file extension '{ext}' for automatic language detection in file '{file_name}'.")


class InteractiveRunSession:
    def __init__(
        self,
        workspace_dir: str,
        language: Optional[str] = None,
        code: str = "",
        file_name: str = "main.py",
    ) -> None:
        from app.services.docker_execution_service import DockerExecutionService

        self.workspace_dir = workspace_dir
        self.code = code
        self.file_name = file_name
        self.language = resolve_language(
            language=language,
            file_name=file_name,
        )

        self.docker_service = DockerExecutionService(timeout_seconds=None)
        self.docker_process = None

    async def start(self) -> str:
        self.docker_process = await self.docker_service.start(
            language=self.language,
            code=self.code,
            file_name=self.file_name,
            interactive=True,
        )

        return f"Executing {self.file_name} ({self.language})..."

    async def read_output(self, websocket: WebSocket) -> None:
        if not self.docker_process:
            return

        try:
            async for text in self.docker_service.read_output(
                self.docker_process
            ):
                text_xterm = text.replace("\r\n", "\n").replace("\n", "\r\n")
                await websocket.send_text(text_xterm)

            process = self.docker_process.process
            ret = process.returncode

            color = "32" if ret == 0 else "31"

            await websocket.send_text(
                f"\r\n\x1b[{color}m"
                f"[Process finished with exit code {ret}]"
                f"\x1b[0m\r\n"
            )

        except Exception:
            pass

    async def write_input(
        self,
        websocket: WebSocket,
        data: str,
    ) -> None:
        if not self.docker_process:
            return

        try:
            pipe_data = data
            if not hasattr(self.docker_process.process, "resize"):
                pipe_data = data.replace("\r", "\n")

            await self.docker_service.write_input(
                self.docker_process,
                pipe_data,
            )

        except Exception:
            pass

    async def resize(self, cols: int, rows: int) -> None:
        if self.docker_process and hasattr(self.docker_process.process, "resize"):
            self.docker_process.process.resize(cols, rows)

    async def stop(self) -> None:
        if self.docker_process:
            try:
                await self.docker_service.stop(
                    self.docker_process
                )
            except Exception:
                pass

            self.docker_process = None

async def handle_interactive_run_websocket(websocket: WebSocket, workspace_dir: str) -> None:
    read_task = None
    session = None

    try:
        init_data = await websocket.receive_json()
        language = init_data.get("language")
        code = init_data.get("content") if "content" in init_data else init_data.get("code", "")
        file_name = init_data.get("fileName", init_data.get("file_name", "main.py"))

        session = InteractiveRunSession(
            workspace_dir=workspace_dir,
            language=language,
            code=code,
            file_name=file_name,
        )

        start_msg = await session.start()
        await websocket.send_text(
            f"\r\n\x1b[36m$ {start_msg}\x1b[0m\r\n\r\n"
        )

        read_task = asyncio.create_task(
            session.read_output(websocket)
        )

        while True:
            raw_msg = await websocket.receive_text()
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                msg = {"type": "input", "data": raw_msg}

            if msg.get("type") == "input":
                await session.write_input(websocket, msg.get("data", ""))
            elif msg.get("type") == "resize":
                await session.resize(
                    max(1, int(msg.get("cols", 120))),
                    max(1, int(msg.get("rows", 30))),
                )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        import traceback
        print("Interactive execution session exception:", exc)
        traceback.print_exc()

        try:
            err_msg = str(exc).replace("\n", "\r\n")
            if err_msg.strip():
                await websocket.send_text(
                    f"\r\n\x1b[31mError: {err_msg}\x1b[0m\r\n"
                )
        except Exception:
            pass

    finally:
        if read_task:
            read_task.cancel()

        if session:
            await session.stop()