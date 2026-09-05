from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_app_settings
from app.core.config import Settings

router = APIRouter(prefix="/auth", tags=["auth"])

async def verify_token(token: str, settings: Settings) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase auth is not configured on the server.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        if settings.supabase_anon_key:
            headers["apikey"] = settings.supabase_anon_key

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers=headers,
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Supabase session.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = response.json()
        user = payload.get("user", payload) if isinstance(payload, dict) else None
        if not isinstance(user, dict) or not user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Supabase session.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_app_settings),
) -> dict:
    authorization = request.headers.get("Authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await verify_token(authorization.split(" ", 1)[1].strip(), settings)


@router.get("/me")
async def get_authenticated_user(current_user: dict = Depends(get_current_user)) -> dict:
    return {"user": current_user}
