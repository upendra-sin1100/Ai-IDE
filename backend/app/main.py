from __future__ import annotations

import asyncio
import subprocess
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except AttributeError:
        pass

from app.api.routes.chat import router as chat_router
from app.api.routes.completion import router as completion_router
from app.api.routes.edit import router as edit_router
from app.api.routes.legacy import router as legacy_router
from app.api.routes.models import router as models_router
from app.api.routes.terminal import router as terminal_router
from app.api.routes.workspace import router as workspace_router
from app.core.config import get_settings
from app.core.lifespan import lifespan
from app.core.logging import configure_logging


class CodeRunRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "status": "ok",
            "name": settings.app_name,
            "docs": "/docs",
            "api_prefix": settings.api_prefix,
        }

    @app.post("/api/run")
    async def run_code(req: CodeRunRequest) -> dict[str, str]:
        import os
        import re
        import sys
        import tempfile

        lang = req.language.lower().strip()
        timeout_sec = 10

        try:
            env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}

            # --- PYTHON ---
            if lang in ["python", "python3", "py"]:
                python_bin = sys.executable or "python3"
                with tempfile.TemporaryDirectory() as temp_dir:
                    script_path = os.path.join(temp_dir, "script.py")
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(req.code)
                    res = subprocess.run(
                        [python_bin, script_path],
                        input=req.stdin,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        env=env,
                        timeout=timeout_sec,
                    )
                    output = (res.stdout or "") + (res.stderr or "")
                    return {"output": output.strip() or "[Process finished with no output]"}

            # --- JAVASCRIPT ---
            elif lang in ["javascript", "js"]:
                with tempfile.TemporaryDirectory() as temp_dir:
                    script_path = os.path.join(temp_dir, "script.js")
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(req.code)
                    res = subprocess.run(
                        ["node", script_path],
                        input=req.stdin,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=timeout_sec,
                    )
                    output = (res.stdout or "") + (res.stderr or "")
                    return {"output": output.strip() or "[Process finished with no output]"}

            # --- TYPESCRIPT ---
            elif lang in ["typescript", "ts"]:
                with tempfile.TemporaryDirectory() as temp_dir:
                    script_path = os.path.join(temp_dir, "script.ts")
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(req.code)
                    
                    cmd = ["npx", "--no-install", "ts-node", "--transpile-only", script_path] if sys.platform != "win32" else ["npx.cmd", "--no-install", "ts-node", "--transpile-only", script_path]
                    try:
                        res = subprocess.run(
                            cmd,
                            input=req.stdin,
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            timeout=timeout_sec,
                        )
                    except Exception:
                        res = subprocess.run(
                            ["node", script_path],
                            input=req.stdin,
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            timeout=timeout_sec,
                        )
                    output = (res.stdout or "") + (res.stderr or "")
                    return {"output": output.strip() or "[Process finished with no output]"}

            # --- JAVA ---
            elif lang in ["java"]:
                match = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", req.code)
                if not match:
                    match = re.search(r"class\s+([A-Za-z0-9_]+)", req.code)
                class_name = match.group(1) if match else "Main"

                with tempfile.TemporaryDirectory() as temp_dir:
                    java_file = os.path.join(temp_dir, f"{class_name}.java")
                    with open(java_file, "w", encoding="utf-8") as f:
                        f.write(req.code)

                    # Compile
                    compile_res = subprocess.run(
                        ["javac", f"{class_name}.java"],
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=timeout_sec,
                        cwd=temp_dir,
                    )
                    if compile_res.returncode != 0:
                        err_out = (compile_res.stderr or compile_res.stdout or "").strip()
                        return {"output": f"Compilation Error:\n{err_out}"}

                    # Run
                    run_res = subprocess.run(
                        ["java", class_name],
                        input=req.stdin,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=timeout_sec,
                        cwd=temp_dir,
                    )
                    output = (run_res.stdout or "") + (run_res.stderr or "")
                    return {"output": output.strip() or "[Process finished with no output]"}

            return {"output": f"Unsupported language: '{req.language}'"}

        except subprocess.TimeoutExpired:
            return {"output": f"Time Limit Exceeded ({timeout_sec}s)"}
        except FileNotFoundError as fnf:
            return {"output": f"Execution Error: Missing compiler/runtime ({str(fnf)})"}
        except Exception as e:
            return {"output": f"Execution Error: {str(e)}"}

    app.include_router(workspace_router, prefix=settings.api_prefix)
    app.include_router(terminal_router, prefix=settings.api_prefix)
    app.include_router(chat_router, prefix=settings.api_prefix)
    app.include_router(completion_router, prefix=settings.api_prefix)
    app.include_router(edit_router, prefix=settings.api_prefix)
    app.include_router(models_router, prefix=settings.api_prefix)
    app.include_router(legacy_router, prefix=settings.api_prefix)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)