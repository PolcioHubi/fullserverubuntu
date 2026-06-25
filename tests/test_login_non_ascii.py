"""Regression: login / admin checks must not crash on non-ASCII credentials.

hmac.compare_digest raises TypeError ("comparing strings with non-ASCII
characters is not supported") for a str with non-ASCII chars. Polish letters are
allowed in usernames, so a user named e.g. "łukasz" used to get HTTP 500 on
login, and admin operations on such a username also 500'd. _secure_str_eq compares
UTF-8 bytes instead.
"""
from app import _secure_str_eq, is_configured_admin_username


def test_secure_str_eq_handles_non_ascii_without_raising():
    assert _secure_str_eq("łąka", "łąka") is True
    assert _secure_str_eq("hasłoĄĘ", "hasłoĄĘ") is True
    assert _secure_str_eq("łąka", "laka") is False
    assert _secure_str_eq("admin", "different") is False


def test_is_configured_admin_username_handles_non_ascii(app):
    with app.app_context():
        # Must return False, NOT raise TypeError.
        assert is_configured_admin_username("łukasząę") is False


def test_login_with_non_ascii_username_does_not_500(client, auth_manager, access_key_service):
    key = access_key_service.generate_access_key("nonascii-login")
    username = "łukasz_pl"
    password = "hasłoĄĘ12"
    ok, msg, _ = auth_manager.register_user(username, password, key, mark_tutorial_seen=True)
    assert ok, msg

    resp = client.post("/login", json={"username": username, "password": password})
    # Before the fix: 500 (TypeError in the admin-shortcut compare_digest).
    assert resp.status_code != 500
    data = resp.get_json()
    assert data and data.get("success") is True
