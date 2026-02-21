import pytest
import datetime
import io
import os
import shutil
import sqlite3
import stat
import tempfile
import uuid
import threading
import zipfile
from sqlalchemy import text
from app import app, import_operation_lock, restart_operation_lock
from models import db, User, AccessKey, Announcement, File
from services import StatisticsService
from user_auth import UserAuthManager

# Fixtures `client`, `admin_client`, `auth_manager`, `access_key_service`, 
# `admin_credentials` are provided by conftest.py


@pytest.fixture
def temp_user(auth_manager, access_key_service):
    """
    Fixture to create a temporary, unique user for testing.
    Cleans up the user after the test.
    """
    username = f"test_user_{uuid.uuid4().hex[:8]}"
    password = "password123"
    access_key = access_key_service.generate_access_key(f"Key for {username}")
    
    success, _, _ = auth_manager.register_user(username, password, access_key)
    assert success, f"Failed to create temporary user {username}"
    
    yield {"username": username, "password": password}
    
    # Cleanup
    user = User.query.filter_by(username=username).first()
    if user:
        db.session.delete(user)
        db.session.commit()


@pytest.fixture
def user_with_files(app, temp_user):
    """
    Fixture to create a user and add some dummy files for them.
    """
    username = temp_user['username']
    user_folder = os.path.join(app.root_path, "user_data", username)
    files_folder = os.path.join(user_folder, "files")
    os.makedirs(files_folder, exist_ok=True)

    dummy_file_path = os.path.join(files_folder, "test_file.txt")
    with open(dummy_file_path, "w") as f:
        f.write("test content")

    stats_service = StatisticsService()
    stats_service.add_or_update_file(
        username=username,
        filename="test_file.txt",
        filepath=dummy_file_path,
        size=os.path.getsize(dummy_file_path),
        file_hash="dummy_hash"
    )
    db.session.commit()

    yield temp_user

    # Cleanup
    if os.path.exists(user_folder):
        shutil.rmtree(user_folder)


def _build_valid_backup_zip_bytes() -> bytes:
    """Create an in-memory backup ZIP with minimal valid structure."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = os.path.join(tmp_dir, "database.db")
        conn = sqlite3.connect(db_path)
        try:
            conn.execute(
                "CREATE TABLE users (username TEXT PRIMARY KEY UNIQUE NOT NULL, password TEXT NOT NULL)"
            )
            conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                ("import_test_user", "hashed_password_placeholder"),
            )
            conn.commit()
        finally:
            conn.close()

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr("user_data/import_test_user/files/dummy.txt", "dummy")
            zipf.write(db_path, "auth_data/database.db")

        return zip_buffer.getvalue()


# --- Authentication and Basic Access Tests ---

def test_admin_login_success(client, admin_credentials):
    """Tests successful admin login."""
    response = client.post(
        "/admin/login",
        json={
            "username": admin_credentials["username"],
            "password": admin_credentials["password"],
        },
    )
    assert response.status_code == 200
    assert response.json["success"]
    assert response.json["message"] == "Logowanie pomyślne"


def test_admin_login_failure(client):
    """Tests admin login with incorrect credentials."""
    response = client.post(
        "/admin/login", json={"username": "wrong", "password": "wrong"}
    )
    assert response.status_code == 401
    assert not response.json["success"]
    assert response.json["error"] == "Nieprawidłowe dane logowania"


def test_admin_logout(admin_client):
    """Tests the admin logout functionality."""
    response = admin_client.get("/admin/logout", follow_redirects=True)
    assert response.status_code == 200
    assert b"Panel Administracyjny" in response.data


def test_admin_panel_access_requires_login(client):
    """Ensures the admin panel is protected."""
    response = client.get("/admin/", follow_redirects=True)
    assert response.status_code == 200
    assert b"Panel Administracyjny" in response.data # Should be redirected to login page


def test_admin_panel_access_with_login(admin_client):
    """Tests that a logged-in admin can access the panel."""
    response = admin_client.get("/admin/")
    assert response.status_code == 200
    assert "Zarządzanie użytkownikami" in response.get_data(as_text=True)


# --- User and Data Management API Tests ---

def test_api_get_users(admin_client):
    """Tests fetching user statistics."""
    response = admin_client.get("/admin/api/users")
    assert response.status_code == 200
    assert response.json["success"]
    assert "users_data" in response.json
    assert "stats" in response.json


def test_api_get_admin_stats(admin_client):
    """Tests lightweight admin stats endpoint used by restart health checks."""
    response = admin_client.get("/admin/api/stats")
    assert response.status_code == 200
    assert response.json["success"] is True
    assert "stats" in response.json
    assert "total_users" in response.json["stats"]
    assert "active_users" in response.json["stats"]


def test_api_import_validate_success(admin_client):
    """Tests import pre-validation endpoint with a valid backup ZIP."""
    zip_bytes = _build_valid_backup_zip_bytes()
    response = admin_client.post(
        "/admin/api/import/validate",
        data={"backupFile": (io.BytesIO(zip_bytes), "backup.zip")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["valid"] is True
    assert "schema_updates_preview" in payload
    assert payload["requires_restart"] is True


def test_api_import_validate_invalid_zip(admin_client):
    """Tests import pre-validation endpoint with invalid ZIP structure."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr("../evil.txt", "bad")

    response = admin_client.post(
        "/admin/api/import/validate",
        data={"backupFile": (io.BytesIO(zip_buffer.getvalue()), "backup.zip")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["valid"] is False
    assert payload["issues"]


def test_api_import_validate_rejects_symlink(admin_client):
    """Tests import pre-validation endpoint rejects symlinks in ZIP entries."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        link_info = zipfile.ZipInfo("user_data/malicious_link")
        link_info.create_system = 3  # Unix metadata semantics
        link_info.external_attr = (stat.S_IFLNK | 0o777) << 16
        zipf.writestr(link_info, "outside_target")
        zipf.writestr("auth_data/database.db", "not-a-real-db")

    response = admin_client.post(
        "/admin/api/import/validate",
        data={"backupFile": (io.BytesIO(zip_buffer.getvalue()), "backup.zip")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["valid"] is False
    assert any("symlink" in issue.lower() for issue in payload["issues"])


def test_api_import_validate_rejects_excessive_uncompressed_size(
    admin_client, monkeypatch
):
    """Tests import pre-validation endpoint rejects oversized archives after decompression."""
    zip_buffer = io.BytesIO(_build_valid_backup_zip_bytes())
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr("user_data/import_test_user/files/oversized.txt", "A" * 4096)

    monkeypatch.setitem(app.config, "IMPORT_MAX_UNCOMPRESSED_BYTES", 1024)

    response = admin_client.post(
        "/admin/api/import/validate",
        data={"backupFile": (io.BytesIO(zip_buffer.getvalue()), "backup.zip")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["valid"] is False
    assert any(
        "Suma rozmiarów plików po rozpakowaniu przekracza" in issue
        for issue in payload["issues"]
    )


def test_api_import_rejects_parallel_run(admin_client):
    """Tests single-flight lock for import endpoint."""
    acquired = import_operation_lock.acquire(blocking=False)
    assert acquired
    try:
        response = admin_client.post(
            "/admin/api/import/all",
            data={},
            content_type="multipart/form-data",
        )
        assert response.status_code == 409
        payload = response.get_json()
        assert payload["success"] is False
        assert payload["code"] == "IMPORT_IN_PROGRESS"
        assert payload["request_id"]
    finally:
        if import_operation_lock.locked():
            import_operation_lock.release()


def test_api_restart_rejects_parallel_run(admin_client):
    """Tests single-flight lock for restart endpoint."""
    acquired = restart_operation_lock.acquire(blocking=False)
    assert acquired
    try:
        response = admin_client.post("/admin/api/restart")
        assert response.status_code == 409
        payload = response.get_json()
        assert payload["success"] is False
        assert payload["code"] == "RESTART_IN_PROGRESS"
        assert payload["request_id"]
    finally:
        if restart_operation_lock.locked():
            restart_operation_lock.release()


def test_api_get_user_logs(admin_client, temp_user):
    """Tests fetching logs for a specific user."""
    response = admin_client.get(f"/admin/api/user-logs/{temp_user['username']}")
    assert response.status_code == 200
    assert response.json["success"]
    assert "logs" in response.json
    assert "submissions" in response.json
    assert "files" in response.json


def test_api_download_user_data(admin_client, user_with_files):
    """Tests downloading a user's data archive."""
    username = user_with_files['username']
    response = admin_client.get(f"/admin/api/download-user/{username}")
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/x-zip-compressed"
    assert response.headers["Content-Disposition"].startswith(
        f"attachment; filename={username}_data.zip"
    )
    assert len(response.data) > 0


def test_api_delete_registered_user_and_files(admin_client, user_with_files):
    """Tests deleting a user and their associated files."""
    username = user_with_files['username']
    user_folder = os.path.join(app.root_path, "user_data", username)
    
    response = admin_client.delete(
        f"/admin/api/delete-registered-user/{username}?delete_files=true"
    )
    
    assert response.status_code == 200
    assert response.json["success"]
    assert "Jego pliki również zostały usunięte" in response.json["message"]

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is None
    
    assert not os.path.exists(user_folder)


def test_api_delete_registered_user_keep_files(admin_client, user_with_files):
    """Tests deleting a user but preserving their files."""
    username = user_with_files['username']
    user_folder = os.path.join(app.root_path, "user_data", username)

    response = admin_client.delete(
        f"/admin/api/delete-registered-user/{username}?delete_files=false"
    )

    assert response.status_code == 200
    assert response.json["success"]
    assert "Jego pliki zostały zachowane" in response.json["message"]

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is None
    
    assert os.path.exists(user_folder)


def test_api_delete_user_files(admin_client, user_with_files):
    """Tests deleting only the files of a user."""
    username = user_with_files['username']
    user_folder = os.path.join(app.root_path, "user_data", username)

    response = admin_client.delete(f"/admin/api/delete-user-files/{username}")
    
    assert response.status_code == 200
    assert response.json["success"]
    assert f"Wszystkie dane użytkownika {username} zostały usunięte" in response.json["message"]

    assert not os.path.exists(user_folder)
    with app.app_context():
        file_meta = File.query.filter_by(user_username=username).first()
        assert file_meta is None


# --- Access Key API Tests ---

def test_api_access_key_lifecycle(admin_client):
    """Tests the full lifecycle of an access key: generation, deactivation, deletion."""
    # 1. Generate
    description = "Lifecycle Test Key"
    response_gen = admin_client.post(
        "/admin/api/generate-access-key",
        json={"description": description, "validity_days": 7},
    )
    assert response_gen.status_code == 200
    assert response_gen.json["success"]
    access_key = response_gen.json["access_key"]

    with app.app_context():
        key_obj = AccessKey.query.filter_by(key=access_key).first()
        assert key_obj is not None
        assert key_obj.is_active

    # 2. Deactivate
    response_deact = admin_client.post(
        "/admin/api/deactivate-access-key", json={"access_key": access_key}
    )
    assert response_deact.status_code == 200
    assert response_deact.json["success"]
    
    with app.app_context():
        key_obj = AccessKey.query.filter_by(key=access_key).first()
        assert key_obj is not None, "Access key should exist"
        assert not key_obj.is_active

    # 3. Delete
    response_del = admin_client.delete(
        "/admin/api/delete-access-key", json={"access_key": access_key}
    )
    assert response_del.status_code == 200
    assert response_del.json["success"]

    with app.app_context():
        key_obj = AccessKey.query.filter_by(key=access_key).first()
        assert key_obj is None


def test_api_get_access_keys_self_heals_missing_table(admin_client):
    """Endpoint should recreate missing tables and avoid returning 500."""
    with app.app_context():
        db.session.execute(text("DROP TABLE IF EXISTS access_keys"))
        db.session.commit()

    response = admin_client.get("/admin/api/access-keys")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert "access_keys" in payload


# --- Registered User Management API Tests ---

def test_api_get_registered_users(admin_client, temp_user):
    """Tests fetching the list of registered users."""
    response = admin_client.get("/admin/api/registered-users")
    assert response.status_code == 200
    assert response.json["success"]
    assert "users" in response.json
    assert any(u['username'] == temp_user['username'] for u in response.json['users'])


def test_api_toggle_user_status(admin_client, temp_user):
    """Tests toggling a user's active status."""
    username = temp_user['username']
    
    # Deactivate
    response_deact = admin_client.post("/admin/api/toggle-user-status", json={"username": username})
    assert response_deact.status_code == 200
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is not None, "User should exist"
        assert not user.is_active

    # Reactivate
    response_act = admin_client.post("/admin/api/toggle-user-status", json={"username": username})
    assert response_act.status_code == 200
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is not None, "User should exist"
        assert user.is_active


def test_api_update_hubert_coins(admin_client, temp_user):
    """Tests updating a user's Hubert Coins balance."""
    username = temp_user['username']
    
    # Add coins
    response_add = admin_client.post("/admin/api/update-hubert-coins", json={"username": username, "amount": 10})
    assert response_add.status_code == 200
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is not None, "User should exist"
        assert user.hubert_coins == 10

    # Subtract coins
    response_sub = admin_client.post("/admin/api/update-hubert-coins", json={"username": username, "amount": -3})
    assert response_sub.status_code == 200
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is not None, "User should exist"
        assert user.hubert_coins == 7


def test_api_update_hubert_coins_insufficient(admin_client, temp_user):
    """Tests that subtracting coins below zero fails."""
    username = temp_user['username']
    response = admin_client.post("/admin/api/update-hubert-coins", json={"username": username, "amount": -10})
    assert response.status_code == 400
    assert not response.json["success"]
    assert response.json["error"] == "Niewystarczająca ilość Hubert Coins"


def test_api_reset_user_password(admin_client, temp_user, auth_manager):
    """Tests resetting a user's password."""
    username = temp_user['username']
    new_password = "new_strong_password_123"
    
    response = admin_client.post(
        "/admin/api/reset-password",
        json={"username": username, "new_password": new_password},
    )
    assert response.status_code == 200
    assert response.json["success"]
    assert response.json["message"] == "Hasło zostało zresetowane"

    # Verify the new password works
    with app.app_context():
        success, _, _ = auth_manager.authenticate_user(username, new_password)
        assert success


# --- Announcement and Log API Tests ---

def test_api_announcement_lifecycle(admin_client):
    """Tests creating and verifying an announcement."""
    announcement_data = {
        "title": "Test Announcement",
        "message": "This is a test message.",
        "type": "warning",
        "expires_at": (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat(),
    }
    response = admin_client.post("/admin/api/announcements", json=announcement_data)
    assert response.status_code == 200
    assert response.json["success"]

    with app.app_context():
        announcement = Announcement.query.filter_by(title="Test Announcement").first()
        assert announcement is not None
        assert announcement.message == "This is a test message."


def test_api_get_logs(admin_client):
    """Tests fetching system logs."""
    response_app = admin_client.get("/admin/api/logs/app.log")
    assert response_app.status_code == 200
    assert response_app.json["success"]
    assert "log_content" in response_app.json

    response_activity = admin_client.get("/admin/api/logs/user_activity.log")
    assert response_activity.status_code == 200
    assert response_activity.json["success"]
    assert "log_content" in response_activity.json


def test_api_get_logs_forbidden(admin_client):
    """Tests that access to arbitrary files via the log endpoint is forbidden."""
    response = admin_client.get("/admin/api/logs/forbidden.log")
    assert response.status_code == 403
    assert not response.json["success"]
    assert response.json["error"] == "Access to this log file is forbidden."


# --- Concurrency Test ---

def test_concurrent_hubert_coins_update(app, temp_user, auth_manager):
    """
    Tests for race conditions when updating Hubert Coins concurrently.
    """
    username = temp_user['username']
    initial_coins = 500 # Start with a high number
    num_threads = 20
    updates_per_thread = 10
    amount_per_update = -1 # Subtract coins

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        assert user is not None, "User should exist"
        user.hubert_coins = initial_coins
        db.session.commit()

    def update_task():
        with app.app_context():
            # Use the same auth_manager instance, which now has a shared lock
            for _ in range(updates_per_thread):
                success, msg = auth_manager.update_hubert_coins(username, amount_per_update)
                # This assertion might still fail intermittently if the lock is not effective
                # but it's better to have it to catch potential issues.
                assert success, f"Update failed in thread: {msg}"

    threads = []
    for _ in range(num_threads):
        thread = threading.Thread(target=update_task)
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()

    with app.app_context():
        final_user = User.query.filter_by(username=username).first()
        assert final_user is not None, "User should exist"
        expected_coins = initial_coins + (num_threads * updates_per_thread * amount_per_update)
        assert final_user.hubert_coins == expected_coins, (
            f"Race condition detected! Expected {expected_coins} coins, but got {final_user.hubert_coins}"
        )
