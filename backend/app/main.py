from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
