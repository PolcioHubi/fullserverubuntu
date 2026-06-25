"""Backup import size limits: 0 = unlimited (large backups allowed), while the
zip-bomb compression-ratio guard stays on by default (can be disabled with 0).

The upload itself is streamed to disk (file.save), so "unlimited" size is a policy
choice, not a memory risk; the import routes also lift the global MAX_CONTENT_LENGTH
per-request via _lift_upload_limit_for_import().
"""
import zipfile

import app as app_module
from app import validate_backup_zip_structure


def _make_backup_zip(path, payload_bytes):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("user_data/u/files/doc.bin", payload_bytes)
        z.writestr("auth_data/database.db", b"x" * 64)


def _incompressible(n):
    # Pseudo-random bytes => per-file compression ratio ~1 (won't trip zip-bomb guard).
    return bytes(((i * 2654435761) >> 3) & 0xFF for i in range(n))


def test_positive_uncompressed_limit_still_rejects(tmp_path, monkeypatch):
    zp = str(tmp_path / "b.zip")
    _make_backup_zip(zp, _incompressible(8192))
    monkeypatch.setitem(app_module.app.config, "IMPORT_MAX_UNCOMPRESSED_BYTES", 1024)
    ok, issues = validate_backup_zip_structure(zp)
    assert not ok
    assert any("rozpakowaniu" in i for i in issues)


def test_zero_limits_mean_unlimited(tmp_path, monkeypatch):
    zp = str(tmp_path / "b.zip")
    _make_backup_zip(zp, _incompressible(8192))
    for k in ("IMPORT_MAX_UNCOMPRESSED_BYTES", "IMPORT_MAX_FILES",
              "IMPORT_MAX_SINGLE_FILE_BYTES"):
        monkeypatch.setitem(app_module.app.config, k, 0)
    ok, issues = validate_backup_zip_structure(zp)
    assert ok, issues


def test_zip_bomb_guard_stays_even_with_unlimited_size(tmp_path, monkeypatch):
    zp = str(tmp_path / "bomb.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("user_data/u/files/bomb.txt", "A" * 5_000_000)  # ~5 MB -> tiny gz
        z.writestr("auth_data/database.db", b"x" * 64)
    for k in ("IMPORT_MAX_UNCOMPRESSED_BYTES", "IMPORT_MAX_FILES",
              "IMPORT_MAX_SINGLE_FILE_BYTES"):
        monkeypatch.setitem(app_module.app.config, k, 0)
    monkeypatch.setitem(app_module.app.config, "IMPORT_MAX_COMPRESSION_RATIO", 100)
    ok, issues = validate_backup_zip_structure(zp)
    assert not ok
    assert any("współczynnik kompresji" in i for i in issues)


def test_zip_bomb_guard_can_be_disabled_with_zero(tmp_path, monkeypatch):
    zp = str(tmp_path / "bomb.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("user_data/u/files/bomb.txt", "A" * 5_000_000)
        z.writestr("auth_data/database.db", b"x" * 64)
    for k in ("IMPORT_MAX_UNCOMPRESSED_BYTES", "IMPORT_MAX_FILES",
              "IMPORT_MAX_SINGLE_FILE_BYTES", "IMPORT_MAX_COMPRESSION_RATIO"):
        monkeypatch.setitem(app_module.app.config, k, 0)
    ok, issues = validate_backup_zip_structure(zp)
    assert ok, issues
