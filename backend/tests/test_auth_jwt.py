import asyncio
import json

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from app.api.routes import auth
from app.core.config import Settings


def test_verify_token_uses_es256_jwks_key(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    public_jwk["kid"] = "test-key"
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="test-key",
    )
    token = jwt.encode(
        {
            "sub": "user-123",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "test-key"},
    )

    async def fake_get_jwks(url, *, refresh=False):
        assert url.endswith("/auth/v1/.well-known/jwks.json")
        return {"test-key": public_jwk}

    monkeypatch.setattr(auth, "_get_jwks", fake_get_jwks)
    user = asyncio.run(auth.verify_token(token, settings))

    assert user["id"] == "user-123"
    assert user["aud"] == "authenticated"


def test_verify_token_refreshes_jwks_when_kid_changes(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    public_jwk["kid"] = "rotated-key"
    settings = Settings(supabase_url="https://example.supabase.co")
    token = jwt.encode(
        {
            "sub": "user-456",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "rotated-key"},
    )
    calls = []

    async def fake_get_jwks(url, *, refresh=False):
        calls.append(refresh)
        return {"rotated-key": public_jwk} if refresh else {"old-key": public_jwk}

    monkeypatch.setattr(auth, "_get_jwks", fake_get_jwks)
    user = asyncio.run(auth.verify_token(token, settings))

    assert user["id"] == "user-456"
    assert calls == [False, True]