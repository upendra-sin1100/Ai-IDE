from __future__ import annotations

import asyncio
import sys
from collections.abc import AsyncIterator

try:
    from winpty import PtyProcess
except ImportError:  # pragma: no cover - exercised only on non-Windows installs
    PtyProcess = None


class PtySession:
    """Run an interactive command through Windows ConPTY."""

    def __init__(self, cmd: str, cwd: str | None = None, cols: int = 120, rows: int = 30):
        if sys.platform != "win32" or PtyProcess is None:
            raise RuntimeError("pywinpty is required for Windows interactive sessions.")

        self.process = PtyProcess.spawn(cmd, cwd=cwd, dimensions=(rows, cols))

    def write(self, data: str) -> None:
        self.process.write(data)

    def resize(self, cols: int, rows: int) -> None:
        self.process.setwinsize(rows, cols)

    def is_alive(self) -> bool:
        return self.process.isalive()

    @property
    def returncode(self) -> int | None:
        if self.is_alive():
            return None
        return self.process.exitstatus

    async def read_stream(self) -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        while self.is_alive() or self.process:
            data = await loop.run_in_executor(None, self._safe_read)
            if data:
                yield data
                continue
            if not self.is_alive():
                break

    def _safe_read(self, size: int = 1024) -> str:
        try:
            return self.process.read(size)
        except EOFError:
            return ""

    def close(self) -> None:
        try:
            self.process.terminate(force=True)
        except Exception:
            pass