import asyncio
import json
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from main import app, global_exception_handler

client = TestClient(app)

def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_global_exception_handler_does_not_leak_the_raw_exception_message():
    """The raw exception message can contain internal details (DB column/
    table names, library internals, query fragments) that shouldn't be
    sent back to whoever hit the API — logged server-side instead."""
    secret_looking_exc = Exception("column activities.rain_threshold_mm does not exist")
    fake_request = MagicMock(method="GET", url=MagicMock(path="/api/trips"))

    response = asyncio.run(global_exception_handler(fake_request, secret_looking_exc))

    assert response.status_code == 500
    body = json.loads(response.body)
    assert body["code"] == "INTERNAL_ERROR"
    assert "rain_threshold_mm" not in body["error"]
    assert body["error"] == "An unexpected error occurred."
