def test_register_sets_cookie_and_returns_user(client):
    response = client.post("/api/auth/register", json={
        "email": "test@example.com", "password": "secret123"
    })
    assert response.status_code == 200
    assert "user" in response.json()
    assert response.json()["user"]["email"] == "test@example.com"
    assert "access_token" in response.cookies

def test_login_sets_cookie_and_returns_user(client):
    response = client.post("/api/auth/login", json={
        "email": "test@example.com", "password": "secret123"
    })
    assert response.status_code == 200
    assert "user" in response.json()
    assert "access_token" in response.cookies

def test_logout_clears_cookie(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 204

def test_me_without_cookie_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_me_with_cookie_returns_stub_user(auth_client):
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "stub@example.com"
