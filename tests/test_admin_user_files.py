"""Admin user-logs lists files from DISK (not only the DB).

Regression for: admin couldn't see a user's uploaded photo / file list when the
file wasn't recorded in the DB File table (e.g., photo not stored, or DB reset).
Scanning the user's files directory always reflects the real files, so the photo
preview and file list work regardless of DB state.
"""
import os
import shutil

import app as app_module


def test_user_logs_lists_files_from_disk_including_photo(admin_client):
    username = "diskscan_user"
    base = os.path.join(app_module.USER_DATA_DIR, username)
    files_folder = os.path.join(base, "files")
    os.makedirs(files_folder, exist_ok=True)
    with open(os.path.join(files_folder, "zdjecie_test.jpg"), "wb") as fh:
        fh.write(b"\xff\xd8\xff" + b"x" * 100)  # fake JPEG, NOT in the DB File table
    with open(os.path.join(files_folder, "dowodnowy_new.html"), "w", encoding="utf-8") as fh:
        fh.write("<html><body>doc</body></html>")
    try:
        resp = admin_client.get(f"/admin/api/user-logs/{username}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        names = {f["name"] for f in data["files"]}
        # Both appear from disk even though neither was recorded in the DB.
        assert "zdjecie_test.jpg" in names
        assert "dowodnowy_new.html" in names
        # The photo (image extension) is discoverable for the preview.
        assert any(n.lower().endswith((".jpg", ".jpeg", ".png", ".gif")) for n in names)
    finally:
        shutil.rmtree(base, ignore_errors=True)


def test_admin_can_load_another_users_photo(admin_client):
    """The admin (session-auth, not flask-login) must be able to GET a user's photo
    for the preview <img>. Before the fix this 302-redirected to /login."""
    username = "imgaccess_user"
    base = os.path.join(app_module.USER_DATA_DIR, username)
    files_folder = os.path.join(base, "files")
    os.makedirs(files_folder, exist_ok=True)
    with open(os.path.join(files_folder, "zdjecie_x.jpg"), "wb") as fh:
        fh.write(b"\xff\xd8\xff" + b"x" * 50)
    try:
        resp = admin_client.get(f"/user_files/{username}/zdjecie_x.jpg")
        assert resp.status_code == 200
    finally:
        shutil.rmtree(base, ignore_errors=True)


def test_regular_user_still_cannot_load_another_users_file(logged_in_client):
    """Security: a normal user must NOT read another user's file (the relaxed
    decorator only adds admin-session; the body still enforces owner-vs-admin)."""
    username = "victim_user"
    base = os.path.join(app_module.USER_DATA_DIR, username)
    files_folder = os.path.join(base, "files")
    os.makedirs(files_folder, exist_ok=True)
    with open(os.path.join(files_folder, "secret.txt"), "w", encoding="utf-8") as fh:
        fh.write("secret")
    try:
        resp = logged_in_client.get(f"/user_files/{username}/secret.txt")
        assert resp.status_code != 200  # 403 (forbidden) — not served
    finally:
        shutil.rmtree(base, ignore_errors=True)
