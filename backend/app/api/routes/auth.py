from __future__ import annotations

import asyncio
import logging

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_app_settings
from app.core.config import Settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

_jwks_cache: dict[str, dict[str, dict]] = {}
_jwks_locks: dict[str, asyncio.Lock] = {}


def _jwks_url(settings: Settings) -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


async def _get_jwks(jwks_url: str, *, refresh: bool = False) -> dict[str, dict]:
    if not refresh and jwks_url in _jwks_cache:
        return _jwks_cache[jwks_url]

    lock = _jwks_locks.setdefault(jwks_url, asyncio.Lock())
    async with lock:
        if not refresh and jwks_url in _jwks_cache:
            return _jwks_cache[jwks_url]

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()

        keys = response.json().get("keys", [])
        jwks = {key["kid"]: key for key in keys if key.get("kid")}
        if not jwks:
            raise ValueError("Supabase JWKS did not contain any keyed public keys.")
        _jwks_cache[jwks_url] = jwks
        return jwks


async def _get_signing_key(token: str, settings: Settings):
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "ES256" or not header.get("kid"):
        raise jwt.InvalidTokenError("Unsupported JWT signing algorithm or missing key id.")

    jwks_url = _jwks_url(settings)
    jwks = await _get_jwks(jwks_url)
    jwk = jwks.get(header["kid"])
    if jwk is None:
        jwks = await _get_jwks(jwks_url, refresh=True)
        jwk = jwks.get(header["kid"])
    if jwk is None:
        raise jwt.InvalidTokenError("JWT signing key was not found in Supabase JWKS.")

    return jwt.algorithms.ECAlgorithm.from_jwk(jwk)

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
    logger.info("Supabase URL configured for token verification: %s", settings.supabase_url)

    try:
        signing_key = await _get_signing_key(token, settings)
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
        )
        user_id = claims.get("sub")
        if not user_id:
            raise jwt.InvalidTokenError("JWT did not contain a subject.")
        return {"id": user_id, **claims}
    except (httpx.HTTPError, jwt.InvalidTokenError, ValueError, KeyError) as exc:
        logger.warning("Token verification failed: %s: %s", type(exc).__name__, exc)
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
