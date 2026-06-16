"""Regression tests for the per-document staleness fingerprint.

Background (the bug these guard against):
    Every generated document and the bundled All-in-One embed a "data_hash" and
    compare it against /api/aio/heartbeat to show a soft "your data changed —
    regenerate" banner. The hash used to be sha256(whole last_form_data.json),
    which ALSO contains ``template_version`` and every *other* document's fields.
    So the moment a user generated a second document type, last_form_data.json
    changed and EVERY previously generated document looked "stale" forever —
    a permanent false orange banner in the downloaded All-in-One.

    The fix fingerprints ONLY the fields a given document actually displays, so a
    document is flagged stale only when *its own* data really changes.
"""
import json
import os

import pytest

import app as app_module
from app import (
    _canonical_doc_key,
    _document_data_hash,
    _inject_doc_guard_js,
)


# Identity + mDowód-specific fields a user would have entered for an ID card.
_MDOWOD_DATA = {
    "imie": "JAN",
    "nazwisko": "KOWALSKI",
    "obywatelstwo": "POLSKIE",
    "data_urodzenia": "1990-01-01",
    "pesel": "90010112345",
    "plec": "M",
    "seria_numer_dowodu": "ABC123456",
    "termin_waznosci_dowodu": "2030-01-01",
    "data_wydania_dowodu": "2020-01-01",
    "seria_numer_mdowodu": "DEF654321",
    "termin_waznosci_mdowodu": "2030-01-01",
    "data_wydania_mdowodu": "2020-01-01",
    "imie_ojca_mdowod": "ADAM",
    "imie_matki_mdowod": "EWA",
    "nazwisko_rodowe": "KOWALSKI",
    "nazwisko_rodowe_ojca": "KOWALSKI",
    "nazwisko_rodowe_matki": "NOWAK",
    "miejsce_urodzenia": "WARSZAWA",
    "adres_zameldowania": "UL. TESTOWA 1, WARSZAWA",
    "data_zameldowania": "2010-01-01",
}


def test_canonical_doc_key_normalises_all_spellings():
    # template_version / DOC_MAP spelling
    assert _canonical_doc_key("new_mdowod") == "mdowod"
    assert _canonical_doc_key("new_school_id") == "school_id"
    assert _canonical_doc_key("new_student_id") == "student_id"
    # bare keys (compiler / NEW_UI_DOC_FILE_MAP) pass through
    assert _canonical_doc_key("mprawojazdy") == "mprawojazdy"
    assert _canonical_doc_key("wozek") == "wozek"
    # unknown → empty (client treats empty hash as "don't warn")
    assert _canonical_doc_key("bogus") == ""
    assert _canonical_doc_key("") == ""
    assert _canonical_doc_key(None) == ""


def test_mdowod_hash_is_invariant_to_other_document_types():
    """The core regression: making a *different* document must not make the
    mDowód look stale."""
    # Submission saved when the user generated the mDowód.
    submission_when_mdowod_made = {**_MDOWOD_DATA, "template_version": "new_mdowod"}

    # A later submission when the user generated a driving licence: same identity
    # + mDowód fields preserved (the form prefills them), but template_version
    # changed and driving-licence fields were added.
    submission_when_licence_made = {
        **_MDOWOD_DATA,
        "template_version": "new_mprawojazdy",
        "pj_kategorie": "B",
        "pj_numer": "PJ/123",
        "pj_organ": "STAROSTA",
    }

    mdowod_hash_before = _document_data_hash(submission_when_mdowod_made, "new_mdowod")
    # Heartbeat would compute the mDowód hash from the *current* file — which is
    # now the licence submission. With the fix it must still match.
    mdowod_hash_after = _document_data_hash(submission_when_licence_made, "mdowod")

    assert mdowod_hash_before, "mDowód hash should be non-empty for real data"
    assert mdowod_hash_before == mdowod_hash_after, (
        "mDowód was flagged stale just because a different document type was "
        "generated — this is the false-positive bug."
    )


def test_distinct_documents_have_distinct_hashes():
    data = {
        **_MDOWOD_DATA,
        "pj_kategorie": "B",
        "pj_numer": "PJ/123",
        "template_version": "new_mprawojazdy",
    }
    assert _document_data_hash(data, "mdowod") != _document_data_hash(data, "mprawojazdy")


def test_hash_changes_when_the_documents_own_field_changes():
    base = {**_MDOWOD_DATA, "template_version": "new_mdowod"}
    changed = {**base, "seria_numer_dowodu": "ZZZ999999"}
    assert _document_data_hash(base, "mdowod") != _document_data_hash(changed, "mdowod")


def test_hash_is_order_independent():
    a = {"pesel": "1", "imie": "JAN", "nazwisko": "K"}
    b = {"nazwisko": "K", "imie": "JAN", "pesel": "1"}
    assert _document_data_hash(a, "mdowod") == _document_data_hash(b, "mdowod")


def test_unknown_doc_key_yields_empty_hash():
    assert _document_data_hash(_MDOWOD_DATA, "bogus") == ""


# ──────────────────────────────────────────────
# Endpoint + injected-guard integration
# ──────────────────────────────────────────────

@pytest.fixture()
def user_form_data_on_disk():
    """Write a realistic last_form_data.json for the logged-in test user and
    return (files_folder, parsed_form_data). Cleans up afterwards."""
    username = "testuser"
    user_dir = os.path.join(app_module.USER_DATA_DIR, username)
    files_folder = os.path.join(user_dir, "files")
    logs_folder = os.path.join(user_dir, "logs")
    os.makedirs(files_folder, exist_ok=True)
    os.makedirs(logs_folder, exist_ok=True)

    form_data = {
        **_MDOWOD_DATA,
        "pj_kategorie": "B",
        "pj_numer": "PJ/123",
        "pj_organ": "STAROSTA",
        "template_version": "new_mprawojazdy",
    }
    fd_path = os.path.join(logs_folder, "last_form_data.json")
    with open(fd_path, "w", encoding="utf-8") as fh:
        json.dump(form_data, fh, ensure_ascii=False, indent=2)

    yield files_folder, form_data

    try:
        os.remove(fd_path)
    except OSError:
        pass


def test_heartbeat_returns_per_document_hashes(logged_in_client, user_form_data_on_disk):
    files_folder, form_data = user_form_data_on_disk

    resp = logged_in_client.get("/api/aio/heartbeat")
    assert resp.status_code == 200
    body = resp.get_json()

    assert body["success"] is True
    assert "data_hashes" in body, "heartbeat must expose per-document hashes"
    hashes = body["data_hashes"]

    # Every known document type is present and matches the per-document hash.
    for doc_key in ("mdowod", "mprawojazdy", "wozek", "school_id", "student_id"):
        assert hashes.get(doc_key) == _document_data_hash(form_data, doc_key)

    # mDowód and mPrawoJazdy must differ (they project different fields).
    assert hashes["mdowod"] != hashes["mprawojazdy"]


def test_injected_doc_guard_matches_heartbeat(logged_in_client, user_form_data_on_disk):
    """The hash baked into a document equals the heartbeat's hash for that doc,
    so a freshly generated document never shows the soft banner."""
    files_folder, form_data = user_form_data_on_disk

    html = "<html><body><h1>doc</h1></body></html>"
    injected = _inject_doc_guard_js(
        html, username="testuser", doc_key="new_mprawojazdy", files_folder=files_folder
    )

    # Canonical key is baked, not the raw template_version spelling.
    assert '"doc_key":"mprawojazdy"' in injected
    # The embedded fingerprint equals what the heartbeat will return for it.
    expected = _document_data_hash(form_data, "mprawojazdy")
    assert f'"data_hash":"{expected}"' in injected
    # Client compares against the per-document map, not a single global hash.
    assert "data_hashes" in injected


def test_doc_guard_self_heals_then_shows_gentle_toast(logged_in_client, user_form_data_on_disk):
    """Stale data → one silent reload (server pages), else a gentle dismissible
    toast — never the old full-width orange banner."""
    files_folder, _ = user_form_data_on_disk
    injected = _inject_doc_guard_js(
        "<html><body>x</body></html>", username="testuser",
        doc_key="new_mdowod", files_folder=files_folder,
    )
    # Self-heal: reload once, guarded by a session flag (no infinite loop).
    assert "location.reload()" in injected
    assert "__doc_guard_reloaded" in injected
    # Reload is skipped inside the All-in-One (embedded data → reload can't help).
    assert "window.__AIO_GUARD" in injected
    # Gentle, dismissible toast instead of the old full-width orange banner.
    assert "doc-guard-toast" in injected
    assert "showToast" in injected
    assert "showWarn" not in injected
    assert "doc-guard-banner" not in injected
    assert "#e67e22" not in injected  # the alarming orange is gone
    # Anti-sharing hard block (different account) must remain.
    assert "showBlock" in injected
    assert "GUARD.username" in injected


def test_aio_guard_has_no_global_soft_warning():
    """compile_allinone's AIO guard must keep the username hard-block but no
    longer carry the global data_hash soft-warning (per-document guards handle
    staleness now)."""
    from compile_allinone import Compiler, generate_spa_router

    router_js = generate_spa_router(selected_docs=["mdowod"], is_per_user=True)
    # Hard block (anti-sharing) stays.
    assert "GUARD.username" in router_js
    # The old global soft-warn message must be gone.
    assert "od ostatniej kompilacji All-in-One" not in router_js

    compiler = Compiler(
        output_path=os.path.join(app_module.USER_DATA_DIR, "x", "files", "allinone.html"),
        user_data_dir=os.path.join(app_module.USER_DATA_DIR, "x", "files"),
        selected_docs=["mdowod"],
    )
    guard_js = compiler._generate_aio_guard_js(None)
    assert "username" in guard_js
    assert "data_hash" not in guard_js
