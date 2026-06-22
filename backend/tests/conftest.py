import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_client():
    c = TestClient(app)
    c.cookies.set("access_token", "stub-token")
    return c
