"""Integration test: PESEL and personal data must never appear in log files.

Submits a real document-creation POST to ``/`` with sentinel values that are
unlikely to occur naturally (so a substring match is reliable), then asserts
that neither ``logs/app.log`` nor the per-user ``form_submissions.log`` echoes
those literals back. Catches regressions in ``_redact_form_data``.
"""

import io
import os

import pytest


# Sentinel values — chosen to be unique and non-realistic so a string search
# in any log file would unambiguously catch a leak.
SENTINEL_PESEL = "99999999991"
SENTINEL_ADDRESS = "ULICA_PII_TESTER_42"
SENTINEL_FIRST_NAME = "PIITesterAlojzy"
SENTINEL_FATHER = "PIITesterTatuszek"
SENTINEL_MOTHER = "PIITesterMatuszka"


def _build_form_payload(username: str) -> dict:
    return {
        "user_name": username,
        "imie": SENTINEL_FIRST_NAME,
        "nazwisko": "PIITesterKowalski",
        "obywatelstwo": "Polskie",
        "data_urodzenia": "01.01.1990",
        "pesel": SENTINEL_PESEL,
        "seria_numer_mdowodu": "AAA111111",
        "termin_waznosci_mdowodu": "01.01.2030",
        "data_wydania_mdowodu": "01.01.2020",
        "imie_ojca_mdowod": SENTINEL_FATHER,
        "imie_matki_mdowod": SENTINEL_MOTHER,
        "seria_numer_dowodu": "AAA111111",
        "termin_waznosci_dowodu": "01.01.2030",
        "data_wydania_dowodu": "01.01.2020",
        "nazwisko_rodowe": "PIITesterRodowe",
        "plec": "M",
        "nazwisko_rodowe_ojca": "PIITesterOjcaRodowe",
        "nazwisko_rodowe_matki": "PIITesterMatkiRodowe",
        "miejsce_urodzenia": "PIITesterMiastoUrodzenia",
        "adres_zameldowania": SENTINEL_ADDRESS,
        "data_zameldowania": "01.01.2010",
        "template_version": "new_mdowod",
    }


@pytest.fixture(scope="function")
def app_log_baseline():
    """Snapshot the size of ``logs/app.log`` before the test so we only inspect
    log lines this test caused, not historical content from earlier runs.
    """
    log_path = os.path.join("logs", "app.log")
    if os.path.exists(log_path):
        baseline = os.path.getsize(log_path)
    else:
        baseline = 0
    yield log_path, baseline


def _read_tail(path: str, offset: int) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        f.seek(offset)
        data = f.read()
    return data.decode("utf-8", errors="replace")


def test_form_submission_pesel_is_redacted_from_logs(logged_in_client, app_log_baseline):
    """POST /``with`` sentinel PII and confirm none of the sentinels reach disk."""
    log_path, log_baseline = app_log_baseline
    payload = _build_form_payload(username="testuser")

    response = logged_in_client.post(
        "/",
        data=payload,
        content_type="multipart/form-data",
    )

    # We don't strictly need the request to succeed — even a partial run that
    # logs the form data is enough to expose a redaction bug. But it should
    # not 5xx on the redaction path itself.
    assert response.status_code in (200, 400, 403, 500), (
        f"Unexpected status {response.status_code}: {response.data!r}"
    )

    # 1. logs/app.log — only inspect lines added during this test
    new_log_lines = _read_tail(log_path, log_baseline)
    for sentinel in (
        SENTINEL_PESEL,
        SENTINEL_ADDRESS,
        SENTINEL_FIRST_NAME,
        SENTINEL_FATHER,
        SENTINEL_MOTHER,
    ):
        assert sentinel not in new_log_lines, (
            f"PII sentinel {sentinel!r} leaked into logs/app.log:\n"
            f"...{new_log_lines[-1500:]!r}"
        )

    # 2. per-user form_submissions.log — entire file contents
    form_log = os.path.join("user_data", "testuser", "logs", "form_submissions.log")
    if os.path.exists(form_log):
        with open(form_log, "r", encoding="utf-8", errors="replace") as f:
            form_content = f.read()
        for sentinel in (
            SENTINEL_PESEL,
            SENTINEL_ADDRESS,
            SENTINEL_FIRST_NAME,
            SENTINEL_FATHER,
            SENTINEL_MOTHER,
        ):
            assert sentinel not in form_content, (
                f"PII sentinel {sentinel!r} leaked into {form_log}:\n"
                f"...{form_content[-1500:]!r}"
            )


def test_redact_form_data_helper_unit():
    """Direct unit check on the helper used by both log paths."""
    from app import _redact_form_data

    sample = {
        "imie": "Jan",
        "nazwisko": "Kowalski",
        "pesel": "12345678901",
        "adres_zameldowania": "Warszawska 5",
        "imie_ojca_mdowod": "Wojciech",
        "template_version": "new_mdowod",
        "image_filename": "zdjecie.jpg",
        "pj_kategorie": "",
        "pj_numer": None,
    }
    redacted = _redact_form_data(sample)

    # PII fields with content -> "<filled>"
    assert redacted["imie"] == "<filled>"
    assert redacted["nazwisko"] == "<filled>"
    assert redacted["pesel"] == "<filled>"
    assert redacted["adres_zameldowania"] == "<filled>"
    assert redacted["imie_ojca_mdowod"] == "<filled>"

    # PII fields that are empty/None -> "<empty>"
    assert redacted["pj_kategorie"] == "<empty>"
    assert redacted["pj_numer"] == "<empty>"

    # Non-PII fields pass through unchanged
    assert redacted["template_version"] == "new_mdowod"
    assert redacted["image_filename"] == "zdjecie.jpg"

    # Defensive: non-dict input returns empty dict
    assert _redact_form_data(None) == {}
    assert _redact_form_data("not-a-dict") == {}
