import pytest
from fastapi import HTTPException
from core.security import create_access_token, decode_access_token


def test_create_and_decode_token():
    token = create_access_token(user_id=42, email="test@example.com")
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["email"] == "test@example.com"


def test_decode_invalid_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token("not.a.real.token")
    assert exc_info.value.status_code == 401


def test_decode_tampered_token_raises_401():
    token = create_access_token(user_id=1, email="test@example.com")
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered)
    assert exc_info.value.status_code == 401
