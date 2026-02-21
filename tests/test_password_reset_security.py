import hashlib

from models import User


def test_forgot_password_does_not_expose_token_by_default(client, registered_user, app):
    """Token must not be exposed unless explicitly enabled outside production."""
    original_flag = app.config.get("EXPOSE_RESET_TOKEN", False)
    app.config["EXPOSE_RESET_TOKEN"] = False
    try:
        response = client.post(
            "/forgot_password", json={"username": registered_user["username"]}
        )
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True
        assert "token" not in payload
    finally:
        app.config["EXPOSE_RESET_TOKEN"] = original_flag


def test_forgot_password_exposes_token_when_flag_enabled(client, registered_user, app):
    """In non-production environments token may be exposed only behind feature flag."""
    original_flag = app.config.get("EXPOSE_RESET_TOKEN", False)
    app.config["EXPOSE_RESET_TOKEN"] = True
    try:
        response = client.post(
            "/forgot_password", json={"username": registered_user["username"]}
        )
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True
        assert payload.get("token")
    finally:
        app.config["EXPOSE_RESET_TOKEN"] = original_flag


def test_recovery_token_is_stored_hashed(auth_manager, access_key_service):
    """Recovery token should be persisted as SHA-256 hash, not plaintext."""
    access_key = access_key_service.generate_access_key("recovery-hash-test")
    username = "recovery_hash_user"
    password = "password123"
    success, _, recovery_token = auth_manager.register_user(username, password, access_key)
    assert success is True
    assert recovery_token is not None

    user = User.query.filter_by(username=username).first()
    assert user is not None, "User should exist"
    assert user.recovery_token != recovery_token
    assert user.recovery_token == hashlib.sha256(
        recovery_token.encode("utf-8")
    ).hexdigest()
    assert user.recovery_token_expires is not None


def test_password_reset_token_is_stored_hashed(auth_manager, registered_user):
    """Password reset token should be persisted as SHA-256 hash, not plaintext."""
    token = auth_manager.generate_password_reset_token(registered_user["username"])
    assert token is not None

    user = User.query.filter_by(username=registered_user["username"]).first()
    assert user is not None, "User should exist"
    assert user.password_reset_token != token
    assert user.password_reset_token == hashlib.sha256(token.encode("utf-8")).hexdigest()
