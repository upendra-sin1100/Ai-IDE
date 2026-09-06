from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
import tempfile
import uuid
import sys
from dataclasses import dataclass
from pathlib import Path

from app.services.pty_runner import PtySession


class _ThreadedPipe:
    def __init__(self, pipe) -> None:
        self._pipe = pipe

    async def read(self, size: int = -1) -> bytes:
        return await asyncio.to_thread(self._pipe.read, size)

    def write(self, data: bytes) -> int:
        return self._pipe.write(data)

    async def drain(self) -> None:
        await asyncio.to_thread(self._pipe.flush)

    def close(self) -> None:
        self._pipe.close()


class _ThreadedProcess:
    def __init__(self, process: subprocess.Popen) -> None:
        self._process = process
        self.stdin = _ThreadedPipe(process.stdin) if process.stdin else None
        self.stdout = _ThreadedPipe(process.stdout) if process.stdout else None
        self.stderr = _ThreadedPipe(process.stderr) if process.stderr else None

    @property
    def returncode(self):
        return self._process.poll()

    async def communicate(self, *args, **kwargs):
        return await asyncio.to_thread(self._process.communicate, *args, **kwargs)

    async def wait(self) -> int:
        return await asyncio.to_thread(self._process.wait)

    def kill(self) -> None:
        self._process.kill()


async def _create_subprocess_exec(*args, **kwargs):
    try:
        return await asyncio.create_subprocess_exec(*args, **kwargs)
    except NotImplementedError:
        # Windows selector loops (used by Uvicorn reload) do not implement
        # asyncio subprocess transports. Keep Docker execution usable there.
        process = await asyncio.to_thread(subprocess.Popen, args, **kwargs)
        return _ThreadedProcess(process)


@dataclass
class DockerProcess:
    container_id: str
    process: object
    workspace_dir: str
    started_at: float
    wait_task: asyncio.Task[None]


class DockerExecutionService:
    """
    Runs untrusted/user code inside short-lived Docker containers.

    The host filesystem is not mounted into the container.
    Code is copied into a temporary execution directory and passed
    to Docker through the container's working directory.
    """

    IMAGES = {
        "python": "python:3.11-slim",
        "javascript": "node:22-alpine",
        "typescript": "node:22-alpine",
        "java": "eclipse-temurin:21-jdk",
        "c": "gcc:latest",
        "cpp": "gcc:latest",
        "go": "golang:1.25-alpine",
        "rust": "rust:1.88-alpine",
        "php": "php:8.4-cli-alpine",
        "ruby": "ruby:3.4-alpine",
    }

    @staticmethod
    def _normalize_source(language: str, code: str) -> str:
        if language.lower().strip() == "php":
            return re.sub(r"^(\s*)<\?\s+php\b", r"\1<?php", code, count=1, flags=re.IGNORECASE)
        return code

    def __init__(
        self,
        memory_limit: str = "256m",
        cpu_limit: str = "1.0",
        timeout_seconds: int | None = 30,
    ) -> None:
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit
        self.timeout_seconds = timeout_seconds

        if shutil.which("docker") is None:
            raise RuntimeError(
                "Docker CLI was not found. Make sure Docker Desktop is running."
            )

    async def _docker(
        self,
        args: list[str],
        *,
        stdin=None,
    ) -> asyncio.subprocess.Process:
        return await _create_subprocess_exec(
            "docker",
            *args,
            stdin=asyncio.subprocess.PIPE if stdin is None else stdin,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

    async def _close_stdin_after_container_exit(
        self,
        container_id: str,
        process: asyncio.subprocess.Process,
    ) -> None:
        started = False
        while process.returncode is None:
            inspect = await _create_subprocess_exec(
                "docker",
                "inspect",
                "--format={{.State.Running}}",
                container_id,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            state, _ = await inspect.communicate()

            if inspect.returncode == 0 and state.strip() == b"true":
                started = True

            if started and inspect.returncode == 0 and state.strip() == b"false":
                if getattr(process, "stdin", None) and process.returncode is None:
                    process.stdin.close()
                return

            await asyncio.sleep(0.1)

    async def pull_image(self, image):
          # Use the local image if it already exists.
        check = await _create_subprocess_exec(
            "docker",
            "image",
            "inspect",
            image,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

        await check.wait()

        if check.returncode == 0:
            return

        # Image is not local, so try downloading it.
        process = await self._docker(["pull", image])
        stdout, _ = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(
                f"Unable to pull Docker image '{image}':\n"
                f"{stdout.decode(errors='replace')}"
            )

    def _language_config(
        self,
        language: str,
        file_name: str,
    ) -> tuple[str, str, str]:
        language = language.lower().strip()

        if language in {"python", "python3", "py"}:
            return (
                self.IMAGES["python"],
                file_name if file_name.endswith(".py") else "main.py",
                "python -u {file}",
            )

        if language in {"javascript", "js"}:
            return (
                self.IMAGES["javascript"],
                file_name if file_name.endswith(".js") else "script.js",
                "node {file}",
            )

        if language in {"typescript", "ts"}:
            return (
                self.IMAGES["typescript"],
                file_name if file_name.endswith(".ts") else "script.ts",
                "npx --yes tsx {file}",
            )

        if language == "java":
            return (
                self.IMAGES["java"],
                "Main.java",
                "",
            )

        if language == "c":
            return (
                self.IMAGES["c"],
                "program.c",
                "gcc program.c -o program && ./program",
            )

        if language in {"cpp", "cxx", "cc"}:
            return (
                self.IMAGES["cpp"],
                "program.cpp",
                "g++ program.cpp -o program && ./program",
            )

        if language == "go":
            return (
                self.IMAGES["go"],
                "main.go",
                "go run main.go",
            )

        if language in {"rust", "rs"}:
            return (
                self.IMAGES["rust"],
                "main.rs",
                "rustc main.rs -o main && ./main",
            )

        if language == "php":
            return (
                self.IMAGES["php"],
                "script.php",
                "php script.php",
            )

        if language in {"ruby", "rb"}:
            return (
                self.IMAGES["ruby"],
                "script.rb",
                "ruby script.rb",
            )

        raise ValueError(f"Unsupported language: {language}")

    async def start(
        self,
        language: str,
        code: str,
        file_name: str = "main.py",
        interactive: bool = False,
    ) -> DockerProcess:
        image, target_file, command = self._language_config(
            language,
            Path(file_name).name,
        )

        execution_dir = tempfile.mkdtemp(prefix="ai_ide_docker_")
        os.chmod(execution_dir, 0o777)
        target_path = Path(execution_dir) / target_file
        container_name = None

        try:
            code = self._normalize_source(language, code)
            target_path.write_text(code, encoding="utf-8")

            # Pulling here makes first-use behavior predictable.
            await self.pull_image(image)

            container_name = f"ai-ide-run-{uuid.uuid4().hex[:12]}"

            docker_args = [
                "create",
                "--name",
                container_name,

                # Security/resource limits.
                "--network",
                "none",
                "--memory",
                self.memory_limit,
                "--cpus",
                self.cpu_limit,
                "--pids-limit",
                "128",

                # Prevent the container from gaining extra privileges.
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges",

                # Read-only root filesystem.
                "--read-only",

                # Small writable temporary filesystem.
                "--tmpfs",
                "/tmp:rw,noexec,nosuid,size=64m",

                # Use the structured syntax so Windows drive letters are not
                # confused with Docker's source/target separator.
                "--mount",
                f"type=bind,source={Path(execution_dir).resolve()},target=/workspace",

                # The image was checked/pulled explicitly above.
                "--pull=never",

                # Keep stdin open for both execution modes.
                "--interactive",

                "-w",
                "/workspace",

                image,
            ]

            if interactive:
                # Interactive runtimes need a PTY for prompt flushing and
                # terminal echo behavior.
                docker_args.insert(docker_args.index(image), "--tty")

            if language.lower().strip() == "java":
                # Java requires compilation followed by execution.
                class_name = Path(target_file).stem

                command = (
                    f"javac {target_file} && "
                    f"java -Dfile.encoding=UTF-8 {class_name}"
                )

            docker_args.extend(["sh", "-c", command.format(file=target_file)])

            launch_process = await self._docker(docker_args)
            launch_output, _ = await launch_process.communicate()
            if launch_process.returncode != 0:
                raise RuntimeError(
                    "Unable to create Docker container:\n"
                    f"{launch_output.decode(errors='replace')}"
                )

            if interactive and sys.platform == "win32":
                process = PtySession(
                    f"docker start --attach --interactive {container_name}",
                    cwd=execution_dir,
                )
            else:
                process = await self._docker(
                    [
                        "start",
                        "--attach",
                        "--interactive",
                        container_name,
                    ]
                )
            wait_task = asyncio.create_task(
                self._close_stdin_after_container_exit(
                    container_name,
                    process,
                )
            )

            # We use a background task to clean up if Docker exits normally.
            return DockerProcess(
                container_id=container_name,
                process=process,
                workspace_dir=execution_dir,
                started_at=asyncio.get_running_loop().time(),
                wait_task=wait_task,
            )

        except Exception:
            if container_name:
                cleanup = await _create_subprocess_exec(
                    "docker",
                    "rm",
                    "-f",
                    container_name,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await cleanup.communicate()
            shutil.rmtree(execution_dir, ignore_errors=True)
            raise

    async def read_output(self, docker_process: DockerProcess):
        process = docker_process.process

        if isinstance(process, PtySession):
            async for text in process.read_stream():
                yield text
            await self.stop(docker_process)
            return

        if not process.stdout:
            return

        deadline = (
            docker_process.started_at + self.timeout_seconds
            if self.timeout_seconds is not None
            else None
        )
        timed_out = False

        try:
            while True:
                try:
                    read_task = process.stdout.read(1024)
                    if deadline is None:
                        data = await read_task
                    else:
                        remaining = deadline - asyncio.get_running_loop().time()
                        if remaining <= 0:
                            timed_out = True
                            break
                        data = await asyncio.wait_for(read_task, timeout=remaining)
                except asyncio.TimeoutError:
                    if process.returncode is None:
                        timed_out = True
                    break

                if not data:
                    break

                yield data.decode("utf-8", errors="replace")

            if timed_out:
                await self.stop(docker_process)
                yield (
                    f"\r\n[Execution timed out after "
                    f"{self.timeout_seconds} seconds]\r\n"
                )
        finally:
            if not docker_process.wait_task.done():
                docker_process.wait_task.cancel()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
            await self.stop(docker_process)
            shutil.rmtree(
                docker_process.workspace_dir,
                ignore_errors=True,
            )

    async def write_input(
        self,
        docker_process: DockerProcess,
        data: str,
    ) -> None:
        """
        Docker's `docker run` process receives stdin directly.
        """
        process = docker_process.process

        if isinstance(process, PtySession):
            process.write(data)
            return

        if process.stdin:
            try:
                process.stdin.write(data.encode("utf-8"))
                await process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError):
                pass

    async def stop(self, docker_process: DockerProcess) -> None:
        """
        Force-remove the execution container.
        """
        try:
            if not docker_process.wait_task.done():
                docker_process.wait_task.cancel()

            if isinstance(docker_process.process, PtySession):
                docker_process.process.close()
            elif docker_process.process.stdin:
                docker_process.process.stdin.close()

            kill_process = await _create_subprocess_exec(
                "docker",
                "rm",
                "-f",
                docker_process.container_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            await kill_process.communicate()

            if not isinstance(docker_process.process, PtySession):
                try:
                    await asyncio.wait_for(
                        docker_process.process.wait(),
                        timeout=3,
                    )
                except asyncio.TimeoutError:
                    docker_process.process.kill()
                    await docker_process.process.wait()

        finally:
            shutil.rmtree(
                docker_process.workspace_dir,
                ignore_errors=True,
            )