"""Tests for the All-in-One loader hardening (perf/reliability fixes).

These lock in the four fixes for the reported "AIO loads forever / white screen /
stuck 15 min" complaints:
  #1 No blocking document.write — the ~40 MB payload is injected via a Blob
     object-URL navigation so the browser parses it incrementally instead of
     freezing the main thread on one synchronous document.write.
  #2 Stream watchdog — the loader's fetch uses an AbortController with a per-chunk
     idle reset and treats received >= X-Payload-Size as completion, so a stalled
     mobile stream surfaces the CTA instead of hanging until the OS reaps the socket.
  #3 Service worker bypasses the shell AND the heavy payload entirely (no redundant
     40 MB cache write, no undefined-on-cache-miss white screen).
  #4 compile() writes payload + shell atomically (tmp + os.replace), payload first,
     so a concurrent reader never streams a half-written file.
"""
import os

from compile_allinone import Compiler, _atomic_write_text


def _loader():
    compiler = Compiler(output_path=os.path.join("x", "files", "allinone.html"))
    return compiler._build_loader_script("allinone.payload.html")


# ── #1: navigate to the real payload URL (no document.write, no single-use blob) ──

def test_loader_navigates_to_payload_url_not_document_write_or_blob():
    loader = _loader()
    # No blocking 40 MB document.write (froze the main thread)...
    assert "document.write" not in loader
    # ...and no single-use blob: URL either: reloading a blob document lands on a
    # browser error page (verified live), which would blank the app on
    # pull-to-refresh / "clear cache". We navigate to the REAL payload URL so the
    # browser parses it incrementally AND manual reload works on a real address.
    assert "createObjectURL" not in loader
    assert "location.replace(" in loader
    assert "allinone.payload.html" in loader
    # The deep-link hash (e.g. #login) is preserved across the navigation.
    assert "location.hash" in loader


# ── #2: stream watchdog ─────────────────────────────────────────────────────

def test_loader_has_idle_stream_watchdog():
    loader = _loader()
    assert "AbortController" in loader
    assert ".abort(" in loader
    # Idle timeout in the 20-30s range (25s), reset per received chunk.
    assert "25000" in loader


def test_loader_completes_on_payload_size_reached():
    loader = _loader()
    # received >= X-Payload-Size is treated as completion (lost final-chunk safety).
    assert "received>=total" in loader


def test_loader_shows_cta_on_failure():
    loader = _loader()
    assert "Przejdź do aplikacji" in loader


def test_loader_bypasses_cache_after_recompile_fresh_param():
    loader = _loader()
    # After an in-AIO recompile the shell reloads with ?fresh=1; the loader must
    # bypass the (max-age) cache so the freshly compiled payload is fetched.
    assert "fresh" in loader
    assert "reload" in loader  # opts.cache = 'reload'


# ── #3: service worker bypass ───────────────────────────────────────────────

def test_service_worker_bypasses_shell_and_payload():
    sw_path = os.path.join("static", "new", "allinone-sw.js")
    with open(sw_path, encoding="utf-8") as fh:
        sw = fh.read()
    # Both the tiny shell and the heavy payload must short-circuit the SW.
    assert "allinone.payload.html" in sw
    assert "allinone.html" in sw
    # Cache version bumped so old cached payloads are purged on activate.
    assert "allinone-v8" in sw


# ── #4: atomic compile write ────────────────────────────────────────────────

def test_atomic_write_text_replaces_via_tmp_and_leaves_no_scratch(tmp_path):
    target = tmp_path / "out.html"
    target.write_text("OLD", encoding="utf-8")
    _atomic_write_text(target, "NEW")
    assert target.read_text(encoding="utf-8") == "NEW"
    assert not (tmp_path / "out.html.tmp").exists()
    assert list(tmp_path.glob("*.tmp")) == []


def test_atomic_write_text_creates_new_file(tmp_path):
    target = tmp_path / "fresh.html"
    _atomic_write_text(target, "HELLO")
    assert target.read_text(encoding="utf-8") == "HELLO"


# ── Assets referenced from data-* attributes must be inlined (not fetched) ───

def test_layout_switcher_svgs_are_inlined():
    """documents.html's customize-layout icons live in data-layout-active-src /
    data-layout-inactive-src attributes (documents.js sets img.src from them).
    The compiler must inline those /assets/ paths as data: URIs, otherwise the
    SVGs are fetched over the network — breaking the self-contained / offline AIO.
    """
    import gzip
    import json
    import shutil

    import app as app_module

    user = "layout_svg_it"
    base = os.path.join(app_module.USER_DATA_DIR, user)
    files = os.path.join(base, "files")
    logs = os.path.join(base, "logs")
    os.makedirs(files, exist_ok=True)
    os.makedirs(logs, exist_ok=True)
    try:
        with open(os.path.join(logs, "last_form_data.json"), "w", encoding="utf-8") as fh:
            json.dump({"imie": "JAN", "template_version": "new_mdowod"}, fh)
        with open(os.path.join(files, "dowodnowy_new.html"), "w", encoding="utf-8") as fh:
            fh.write(app_module._inject_doc_guard_js(
                "<html><body><h1>x</h1></body></html>", user, "new_mdowod", files))

        Compiler(
            output_path=os.path.join(files, "allinone.html"),
            user_data_dir=files,
            selected_docs=["mdowod"],
        ).compile()

        payload = gzip.decompress(
            open(os.path.join(files, "allinone.payload.html.gz"), "rb").read()
        ).decode("utf-8")

        # No leftover network URLs for the layout icons — all inlined as data: URIs.
        assert "id001_active_overlap_layout.svg" not in payload
        assert "/assets/svg/documents/customize/" not in payload
        assert 'data-layout-active-src="data:image/svg' in payload
    finally:
        shutil.rmtree(base, ignore_errors=True)
