def test_get_prefs_requires_auth(client):
    response = client.get("/api/notifications/preferences")
    assert response.status_code == 401

def test_get_prefs_returns_stub(auth_client):
    response = auth_client.get("/api/notifications/preferences")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_update_prefs_returns_stub(auth_client):
    response = auth_client.put("/api/notifications/preferences",
                                json={"email_enabled": True, "rain_threshold_mm": 5.0})
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"

def test_send_test_email_returns_stub(auth_client):
    response = auth_client.post("/api/notifications/test")
    assert response.status_code == 200
    assert response.json()["status"] == "not_implemented"
