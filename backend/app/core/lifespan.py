from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app.core.config import Settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings: Settings = app.state.settings
    timeout = httpx.Timeout(connect=10.0, read=60.0, write=15.0, pool=10.0)

    app.state.gemini_client = httpx.AsyncClient(base_url=settings.gemini_api_url, timeout=timeout)

    try:
        yield
    finally:
        await app.state.gemini_client.aclose()
