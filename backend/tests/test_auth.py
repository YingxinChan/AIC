import uuid


def test_register_creates_user_and_returns_token(client):
    email = f"test+{uuid.uuid4()}@example.com"
    response = client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == email
    assert response.json()["token"]


def test_register_duplicate_email_returns_409(client):
    email = f"test+{uuid.uuid4()}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    assert response.status_code == 409


def test_login_valid_credentials_returns_token(client):
    email = f"test+{uuid.uuid4()}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/login", json={"email": email, "password": "pass123"})
    assert response.status_code == 200
    assert response.json()["token"]


def test_login_wrong_password_returns_401(client):
    email = f"test+{uuid.uuid4()}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/login", json={"email": email, "password": "wrongpass"})
    assert response.status_code == 401


def test_login_is_case_insensitive_on_email(client):
    email = f"Test+{uuid.uuid4()}@Example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/login", json={"email": email.upper(), "password": "pass123"})
    assert response.status_code == 200


def test_login_ignores_leading_trailing_whitespace_on_email(client):
    email = f"test+{uuid.uuid4()}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/login", json={"email": f"  {email}  ", "password": "pass123"})
    assert response.status_code == 200


def test_register_duplicate_email_is_case_insensitive(client):
    email = f"test+{uuid.uuid4()}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    response = client.post("/api/auth/register", json={"email": email.upper(), "password": "pass123"})
    assert response.status_code == 409


def test_logout_succeeds(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 204


def test_me_without_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token_returns_user(client):
    email = f"test+{uuid.uuid4()}@example.com"
    reg = client.post("/api/auth/register", json={"email": email, "password": "pass123"})
    token = reg.json()["token"]
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == email


def test_me_with_invalid_token_returns_401(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401
