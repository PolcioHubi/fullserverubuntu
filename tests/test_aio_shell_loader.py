"""Tests for the All-in-One shell + payload split (real download progress).

The 42 MB All-in-One can't show a real download % from inside a single file —
by the time its JS runs, the browser already downloaded it. So compilation now
emits a tiny *shell* (allinone.html) that streams the heavy *payload*
(allinone.payload.html) with a real byte-based progress bar, then injects it via
document.write.
"""
import gzip
import os

import pytest

import app as app_module
from compile_allinone import Compiler


def _compiler():
    return Compiler(output_path=os.path.join("x", "files", "allinone.html"))


# ── Shell / loader / cover unit tests (no full compile) ──────────────────────

def test_shell_is_a_tiny_loader_not_the_app():
    shell = _compiler()._build_shell("allinone.payload.html")
    # References + streams the payload, shows a real progress bar, then hands the
    # bytes to the browser as a Blob object-URL navigation — NOT a blocking
    # document.write of a 40 MB string (that synchronous parse froze the phone).
    assert "allinone.payload.html" in shell
    assert "fetch(" in shell
    assert "getReader" in shell
    assert "X-Payload-Size" in shell
    assert "location.replace(" in shell  # navigates to the real payload URL
    assert "document.write" not in shell  # fix #1: no blocking 40 MB parse
    assert "createObjectURL" not in shell  # no single-use blob: URL (breaks reload)
    assert "aio-fill" in shell  # the progress bar lives in the shell
    # The shell must NOT carry the heavy app — that's the whole point.
    assert "__AIO_GUARD" not in shell
    assert "__EMBEDDED_USER_DATA" not in shell
    assert "SPA Router" not in shell
    # It must be small (logo is the only sizeable inline asset).
    assert len(shell.encode("utf-8")) < 120 * 1024


def test_loader_progress_uses_payload_size_then_falls_back():
    loader = _compiler()._build_loader_script("allinone.payload.html")
    # Real % from the uncompressed size header, Content-Length fallback, then MB.
    assert "X-Payload-Size" in loader
    assert "Content-Length" in loader
    assert "received/total*100" in loader
    assert "MB" in loader
    # Caps mid-stream at 99 and only hits 100 once fully received.
    assert "Math.min(99" in loader
    assert "set(100)" in loader
    # Graceful fallback for very old browsers / fetch errors.
    assert "window.location.replace(" in loader
    assert "Przejdź do aplikacji" in loader


def test_payload_cover_has_no_progress_bar():
    style, html, script = _compiler()._build_payload_cover()
    assert "aio-cover" in html
    # The bar belongs to the shell; the payload cover is just a brief veil.
    assert "aio-fill" not in html
    assert "aio-pct" not in html
    # Hides on window.load, with an 8s safety net.
    assert "aio-hide" in script
    assert "8000" in script


# ── Route: payload exposes its true size ─────────────────────────────────────

@pytest.fixture()
def payload_on_disk():
    username = "testuser"
    files_folder = os.path.join(app_module.USER_DATA_DIR, username, "files")
    os.makedirs(files_folder, exist_ok=True)
    path = os.path.join(files_folder, "allinone.payload.html")
    gz_path = path + ".gz"
    # This fixture exercises the LEGACY plain-payload branch — ensure no stale
    # .gz from another test is present (the route prefers .gz when it exists).
    try:
        os.remove(gz_path)
    except OSError:
        pass
    body = "<!DOCTYPE html><html><body>" + ("x" * 4096) + "</body></html>"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)
    yield path, len(body.encode("utf-8"))
    for p in (path, gz_path):
        try:
            os.remove(p)
        except OSError:
            pass


def test_user_files_exposes_payload_size_header(logged_in_client, payload_on_disk):
    _, size = payload_on_disk
    resp = logged_in_client.get("/user_files/allinone.payload.html")
    assert resp.status_code == 200
    assert resp.headers.get("X-Payload-Size") == str(size)


# ── Integration: a real compile writes both files ────────────────────────────

def test_full_compile_writes_shell_and_payload():
    import json
    import shutil

    user = "shell_loader_it"
    base = os.path.join(app_module.USER_DATA_DIR, user)
    files = os.path.join(base, "files")
    logs = os.path.join(base, "logs")
    os.makedirs(files, exist_ok=True)
    os.makedirs(logs, exist_ok=True)
    try:
        with open(os.path.join(logs, "last_form_data.json"), "w", encoding="utf-8") as fh:
            json.dump(
                {"imie": "JAN", "nazwisko": "KOWALSKI", "pesel": "90010112345",
                 "template_version": "new_mdowod"},
                fh,
            )
        with open(os.path.join(files, "dowodnowy_new.html"), "w", encoding="utf-8") as fh:
            fh.write(app_module._inject_doc_guard_js(
                "<html><body><h1>MDOWOD</h1></body></html>", user, "new_mdowod", files))

        Compiler(
            output_path=os.path.join(files, "allinone.html"),
            user_data_dir=files,
            selected_docs=["mdowod"],
        ).compile()

        shell_path = os.path.join(files, "allinone.html")
        plain_path = os.path.join(files, "allinone.payload.html")
        gz_path = plain_path + ".gz"
        assert os.path.exists(shell_path)
        # Fix #5a (gz-only): only the gzipped payload is kept on disk (~45 MB/user
        # saved); the uncompressed plain payload is NOT written.
        assert not os.path.exists(plain_path)
        assert os.path.exists(gz_path)
        # Shell is tiny; the gz payload is the heavy one.
        assert os.path.getsize(shell_path) < 200 * 1024
        assert os.path.getsize(gz_path) > os.path.getsize(shell_path) * 3

        shell = open(shell_path, encoding="utf-8").read()
        payload = gzip.decompress(open(gz_path, "rb").read()).decode("utf-8")
        assert "allinone.payload.html" in shell and "location.replace(" in shell
        assert "document.write" not in shell
        assert "createObjectURL" not in shell
        assert "__AIO_GUARD" not in shell
        assert "__AIO_GUARD" in payload and "page-section" in payload
        # Fix #4: atomic write leaves no .tmp scratch files behind.
        assert not os.path.exists(shell_path + ".tmp")
        assert not os.path.exists(gz_path + ".tmp")
    finally:
        shutil.rmtree(base, ignore_errors=True)


# ── Route: pre-gzipped payload served with Content-Encoding ──────────────────

def _write_payload_pair(plain):
    """Write allinone.payload.html + .gz for the logged-in test user; return paths."""
    files_folder = os.path.join(app_module.USER_DATA_DIR, "testuser", "files")
    os.makedirs(files_folder, exist_ok=True)
    plain_path = os.path.join(files_folder, "allinone.payload.html")
    gz_path = plain_path + ".gz"
    with open(plain_path, "w", encoding="utf-8") as fh:
        fh.write(plain)
    with open(gz_path, "wb") as fh:
        fh.write(gzip.compress(plain.encode("utf-8"), compresslevel=6))
    return plain_path, gz_path


def test_user_files_serves_gzip_payload_when_accepted(logged_in_client):
    plain = "<!DOCTYPE html><html><body>" + ("y" * 50000) + "</body></html>"
    plain_path, gz_path = _write_payload_pair(plain)
    try:
        resp = logged_in_client.get(
            "/user_files/allinone.payload.html", headers={"Accept-Encoding": "gzip"}
        )
        assert resp.status_code == 200
        assert resp.headers.get("Content-Encoding") == "gzip"
        assert "text/html" in resp.headers.get("Content-Type", "")
        # X-Payload-Size stays the UNCOMPRESSED size — the loader needs it for %.
        assert resp.headers.get("X-Payload-Size") == str(len(plain.encode("utf-8")))
        assert "Accept-Encoding" in resp.headers.get("Vary", "")
        # Lossless: the gzip body decompresses back to the exact original.
        assert gzip.decompress(resp.data).decode("utf-8") == plain
    finally:
        for p in (plain_path, gz_path):
            try:
                os.remove(p)
            except OSError:
                pass


def test_user_files_serves_plain_payload_without_gzip(logged_in_client):
    plain = "<!DOCTYPE html><html><body>plain-fallback</body></html>"
    plain_path, gz_path = _write_payload_pair(plain)
    try:
        resp = logged_in_client.get(
            "/user_files/allinone.payload.html", headers={"Accept-Encoding": "identity"}
        )
        assert resp.status_code == 200
        assert resp.headers.get("Content-Encoding") != "gzip"
        assert resp.data.decode("utf-8") == plain
        assert resp.headers.get("X-Payload-Size") == str(len(plain.encode("utf-8")))
    finally:
        for p in (plain_path, gz_path):
            try:
                os.remove(p)
            except OSError:
                pass


# ── gz-only on disk (no uncompressed plain file) ─────────────────────────────

def _write_gz_only(plain):
    """Write ONLY the .gz (no plain) for the logged-in test user; return paths."""
    files_folder = os.path.join(app_module.USER_DATA_DIR, "testuser", "files")
    os.makedirs(files_folder, exist_ok=True)
    plain_path = os.path.join(files_folder, "allinone.payload.html")
    gz_path = plain_path + ".gz"
    try:
        os.remove(plain_path)  # ensure NO uncompressed file
    except OSError:
        pass
    with open(gz_path, "wb") as fh:
        fh.write(gzip.compress(plain.encode("utf-8"), compresslevel=6))
    return plain_path, gz_path


def test_user_files_serves_gz_only_payload_with_uncompressed_size(logged_in_client):
    plain = "<!DOCTYPE html><html><body>" + ("z" * 70000) + "</body></html>"
    plain_bytes = plain.encode("utf-8")
    plain_path, gz_path = _write_gz_only(plain)
    try:
        resp = logged_in_client.get(
            "/user_files/allinone.payload.html", headers={"Accept-Encoding": "gzip"}
        )
        assert resp.status_code == 200
        assert not os.path.exists(plain_path)  # served from .gz, no plain needed
        assert resp.headers.get("Content-Encoding") == "gzip"
        # X-Payload-Size = the UNCOMPRESSED size, read from the gzip trailer.
        assert resp.headers.get("X-Payload-Size") == str(len(plain_bytes))
        assert gzip.decompress(resp.data).decode("utf-8") == plain
    finally:
        try:
            os.remove(gz_path)
        except OSError:
            pass


def test_user_files_decompresses_gz_only_for_non_gzip_client(logged_in_client):
    plain = "<!DOCTYPE html><html><body>no-gzip-client</body></html>"
    plain_path, gz_path = _write_gz_only(plain)
    try:
        resp = logged_in_client.get(
            "/user_files/allinone.payload.html", headers={"Accept-Encoding": "identity"}
        )
        assert resp.status_code == 200
        assert resp.headers.get("Content-Encoding") != "gzip"
        assert resp.data.decode("utf-8") == plain  # decompressed on the fly
    finally:
        try:
            os.remove(gz_path)
        except OSError:
            pass


# ── Single-fetch: payload uses a short max-age so the post-stream navigation
#    reuses the cached copy (no second network request), shell stays no-cache ──

def test_payload_uses_short_max_age_for_single_fetch(logged_in_client):
    plain = "<!DOCTYPE html><html><body>cache-policy</body></html>"
    _plain_path, gz_path = _write_gz_only(plain)
    try:
        resp = logged_in_client.get(
            "/user_files/allinone.payload.html", headers={"Accept-Encoding": "gzip"}
        )
        assert resp.status_code == 200
        cc = resp.headers.get("Cache-Control", "")
        # Short max-age => the shell's navigation (ms after the streaming fetch)
        # reuses the just-downloaded copy from cache, so the payload hits the
        # network only ONCE. Must NOT be no-cache (which forces a 2nd request).
        assert "max-age" in cc
        assert "no-cache" not in cc
    finally:
        try:
            os.remove(gz_path)
        except OSError:
            pass


def test_shell_stays_no_cache_for_freshness(logged_in_client):
    files_folder = os.path.join(app_module.USER_DATA_DIR, "testuser", "files")
    os.makedirs(files_folder, exist_ok=True)
    shell_path = os.path.join(files_folder, "allinone.html")
    with open(shell_path, "w", encoding="utf-8") as fh:
        fh.write("<!DOCTYPE html><html><body>shell</body></html>")
    try:
        resp = logged_in_client.get("/user_files/allinone.html")
        assert resp.status_code == 200
        # The tiny shell must always revalidate so a recompiled app is picked up.
        assert "no-cache" in resp.headers.get("Cache-Control", "")
    finally:
        try:
            os.remove(shell_path)
        except OSError:
            pass
