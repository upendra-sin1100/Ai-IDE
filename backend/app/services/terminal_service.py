from __future__ import annotations

import asyncio
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


class InteractiveRunSession:
    def __init__(self, workspace_dir: str, language: str, code: str, file_name: str = "main.py") -> None:
        self.workspace_dir = workspace_dir
        self.language = language.lower().strip()
        self.code = code
        self.file_name = file_name
        self.process: Optional[asyncio.subprocess.Process] = None
        self.temp_dir: Optional[str] = None

    async def start(self) -> str:
        import tempfile
        import re

        self.temp_dir = tempfile.mkdtemp(prefix="ai_ide_run_")
        env = {
            **os.environ,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUNBUFFERED": "1",
            "PYTHONUTF8": "1",
        }

        # --- PYTHON ---
        if self.language in ["python", "python3", "py"]:
            python_bin = sys.executable or "python3"
            clean_name = os.path.basename(self.file_name)
            target_name = clean_name if clean_name.endswith(".py") else "main.py"
            target_path = os.path.join(self.temp_dir, target_name)
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(self.code)

            cmd = [python_bin, "-u", target_path]
            self.process = await _start_subprocess(cmd, cwd=self.temp_dir, env=env)
            return f"Executing {target_name} (Python)..."

        # --- JAVASCRIPT ---
        elif self.language in ["javascript", "js"]:
            target_path = os.path.join(self.temp_dir, "script.js")
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(self.code)

            cmd = ["node", target_path]
            self.process = await _start_subprocess(cmd, cwd=self.temp_dir)
            return f"Executing {self.file_name} (Node.js)..."

        # --- TYPESCRIPT ---
        elif self.language in ["typescript", "ts"]:
            target_path = os.path.join(self.temp_dir, "script.ts")
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(self.code)

            cmd = ["npx", "ts-node", "--transpile-only", target_path] if sys.platform != "win32" else ["npx.cmd", "ts-node", "--transpile-only", target_path]
            try:
                self.process = await _start_subprocess(cmd, cwd=self.temp_dir)
            except Exception:
                cmd = ["node", target_path]
                self.process = await _start_subprocess(cmd, cwd=self.temp_dir)
            return f"Executing {self.file_name} (TypeScript)..."

        # --- JAVA ---
        elif self.language in ["java"]:
            match = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", self.code)
            if not match:
                match = re.search(r"class\s+([A-Za-z0-9_]+)", self.code)
            class_name = match.group(1) if match else "Main"

            java_file = os.path.join(self.temp_dir, f"{class_name}.java")
            with open(java_file, "w", encoding="utf-8") as f:
                f.write(self.code)

            # Compile step
            compile_proc = await _start_subprocess(["javac", f"{class_name}.java"], cwd=self.temp_dir)
            stdout, _ = await compile_proc.communicate()
            if compile_proc.returncode != 0:
                raise RuntimeError(f"Compilation Error:\r\n{stdout.decode('utf-8', errors='replace')}")

            # Run step
            cmd = ["java", "-Dfile.encoding=UTF-8", class_name]
            self.process = await _start_subprocess(cmd, cwd=self.temp_dir)
            return f"Executing {class_name}.java (Java)..."

        else:
            raise ValueError(f"Unsupported language: {self.language}")

    async def read_output(self, websocket: WebSocket) -> None:
        if not self.process or not getattr(self.process, "stdout", None):
            return

        try:
            while True:
                if isinstance(self.process, asyncio.subprocess.Process):
                    data = await self.process.stdout.read(1)
                else:
                    data = await asyncio.to_thread(self.process.stdout.read, 1)
                if not data:
                    break

                try:
                    if not isinstance(self.process, asyncio.subprocess.Process):
                        buffered = await asyncio.to_thread(self.process.stdout.read, 0)
                        if buffered:
                            data += buffered
                except Exception:
                    pass

                text = data.decode("utf-8", errors="replace")
                text_xterm = text.replace("\r\n", "\n").replace("\n", "\r\n")
                await websocket.send_text(text_xterm)

            if isinstance(self.process, asyncio.subprocess.Process):
                await self.process.wait()
            else:
                await asyncio.to_thread(self.process.wait)
            ret = self.process.returncode
            color = "32" if ret == 0 else "31"
            await websocket.send_text(f"\r\n\x1b[{color}m[Process finished with exit code {ret}]\x1b[0m\r\n")
        except Exception:
            pass

    async def write_input(self, websocket: WebSocket, data: str) -> None:
        if self.process and getattr(self.process, "stdin", None):
            try:
                if isinstance(self.process, asyncio.subprocess.Process):
                    pipe_data = data.replace("\r", "\n")
                    self.process.stdin.write(pipe_data.encode("utf-8"))
                    await self.process.stdin.drain()
                else:
                    pipe_data = data.replace("\r", "\n").encode("utf-8")
                    await asyncio.to_thread(self.process.stdin.write, pipe_data)
                    await asyncio.to_thread(self.process.stdin.flush)

                echo_text = data.replace("\r", "\r\n")
                if data in ["\x7f", "\b"]:
                    echo_text = "\b \b"
                await websocket.send_text(echo_text)
            except Exception:
                pass

    def stop(self) -> None:
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass
        if self.temp_dir:
            try:
                import shutil
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            except Exception:
                pass


async def handle_interactive_run_websocket(websocket: WebSocket, workspace_dir: str) -> None:
    await websocket.accept()

    read_task = None
    session = None

    try:
        init_data = await websocket.receive_json()
        language = init_data.get("language", "python")
        code = init_data.get("code", "")
        file_name = init_data.get("fileName", "main.py")

        session = InteractiveRunSession(workspace_dir, language, code, file_name)
        start_msg = await session.start()
        await websocket.send_text(f"\r\n\x1b[36m$ {start_msg}\x1b[0m\r\n\r\n")

        read_task = asyncio.create_task(session.read_output(websocket))

        while True:
            msg = await websocket.receive_text()
            await session.write_input(websocket, msg)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        import traceback
        print("Interactive execution session exception:", exc)
        traceback.print_exc()
        try:
            err_msg = str(exc).replace("\n", "\r\n")
            if err_msg.strip():
                await websocket.send_text(f"\r\n\x1b[31mError: {err_msg}\x1b[0m\r\n")
        except Exception:
            pass
    finally:
        if read_task:
            read_task.cancel()
        if session:
            session.stop()

