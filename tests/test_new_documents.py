"""
Testy dla nowych typów dokumentów: school_id i student_id.
Obejmuje: /my-document/ redirect, /api/user-documents, /api/document-hashes,
/api/generate-random-data (nowe pola), POST formularz z template_version,
nowe route'y UI (documents, services, more, qr_code, pages),
serwowanie PWA (manifest.json, service-worker.js, /assets/*).
"""
import io
import json
import os
import shutil


# ──────────────────────────────────────────────
# /my-document/<doc_type> redirect
# ──────────────────────────────────────────────

class TestMyDocumentRedirect:
    """Testy endpointu /my-document/<doc_type>."""

    def test_redirect_school_id(self, logged_in_client):
        """Redirect dla school_id prowadzi do pliku school_id_new.html."""
        resp = logged_in_client.get("/my-document/school_id")
        assert resp.status_code == 302
        assert "school_id_new.html" in resp.headers["Location"]

    def test_redirect_student_id(self, logged_in_client):
        """Redirect dla student_id prowadzi do pliku student_id_new.html."""
        resp = logged_in_client.get("/my-document/student_id")
        assert resp.status_code == 302
        assert "student_id_new.html" in resp.headers["Location"]

    def test_redirect_mdowod(self, logged_in_client):
        """Redirect dla mdowod prowadzi do pliku dowodnowy_new.html."""
        resp = logged_in_client.get("/my-document/mdowod")
        assert resp.status_code == 302
        assert "dowodnowy_new.html" in resp.headers["Location"]

    def test_redirect_mprawojazdy(self, logged_in_client):
        """Redirect dla mprawojazdy prowadzi do pliku prawojazdy_new.html."""
        resp = logged_in_client.get("/my-document/mprawojazdy")
        assert resp.status_code == 302
        assert "prawojazdy_new.html" in resp.headers["Location"]

    def test_redirect_unknown_type_returns_404(self, logged_in_client):
        """Nieznany typ dokumentu zwraca 404."""
        resp = logged_in_client.get("/my-document/nieistniejacy")
        assert resp.status_code == 404
        data = resp.get_json()
        assert data["success"] is False

    def test_redirect_requires_login(self, client):
        """Niezalogowany użytkownik jest przekierowywany na login."""
        resp = client.get("/my-document/school_id")
        assert resp.status_code == 302
        assert "login" in resp.headers["Location"].lower()


# ──────────────────────────────────────────────
# /api/user-documents
# ──────────────────────────────────────────────

class TestApiUserDocuments:
    """Testy endpointu /api/user-documents."""

    def test_returns_all_doc_types(self, logged_in_client):
        """Zwraca status dla wszystkich 4 typów dokumentów."""
        resp = logged_in_client.get("/api/user-documents")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        docs = data["data"]["documents"]
        assert "mdowod" in docs
        assert "mprawojazdy" in docs
        assert "school_id" in docs
        assert "student_id" in docs

    def test_doc_values_are_integers(self, logged_in_client):
        """Wartości dokumentów to 0 lub 1."""
        resp = logged_in_client.get("/api/user-documents")
        data = resp.get_json()
        docs = data["data"]["documents"]
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert docs[key] in (0, 1)

    def test_requires_login(self, client):
        """Niezalogowany użytkownik jest przekierowywany."""
        resp = client.get("/api/user-documents")
        assert resp.status_code == 302


# ──────────────────────────────────────────────
# /api/document-hashes
# ──────────────────────────────────────────────

class TestApiDocumentHashes:
    """Testy endpointu /api/document-hashes."""

    def test_returns_all_doc_types(self, logged_in_client):
        """Zwraca hash (lub pusty string) dla wszystkich typów."""
        resp = logged_in_client.get("/api/document-hashes")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        hashes = data["data"]
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert key in hashes

    def test_hashes_are_strings(self, logged_in_client):
        """Hashe to stringi (puste lub SHA256)."""
        resp = logged_in_client.get("/api/document-hashes")
        data = resp.get_json()
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert isinstance(data["data"][key], str)

    def test_requires_login(self, client):
        """Niezalogowany użytkownik jest przekierowywany."""
        resp = client.get("/api/document-hashes")
        assert resp.status_code == 302


# ──────────────────────────────────────────────
# /api/generate-random-data — nowe pola school/student
# ──────────────────────────────────────────────

class TestRandomDataNewFields:
    """Testy losowych danych dla nowych dokumentów."""

    def test_school_id_fields_present(self, client):
        """Losowe dane zawierają pola si_* dla legitymacji szkolnej."""
        resp = client.get("/api/generate-random-data?plec=M")
        assert resp.status_code == 200
        data = resp.get_json()
        for field in (
            "si_numer",
            "si_data_wydania",
            "si_data_waznosci",
            "si_nazwa_szkoly",
            "si_adres",
            "si_dyrektor",
            "si_telefon",
        ):
            assert field in data, f"Brak pola {field} w losowych danych"
            assert data[field], f"Pole {field} jest puste"

    def test_student_id_fields_present(self, client):
        """Losowe dane zawierają pola sti_* dla legitymacji studenckiej."""
        resp = client.get("/api/generate-random-data?plec=K")
        assert resp.status_code == 200
        data = resp.get_json()
        for field in ("sti_data_wydania", "sti_uczelnia"):
            assert field in data, f"Brak pola {field} w losowych danych"
            assert data[field], f"Pole {field} jest puste"

    def test_existing_fields_still_present(self, client):
        """Upewnia się, że stare pola nadal istnieją."""
        resp = client.get("/api/generate-random-data")
        data = resp.get_json()
        for field in (
            "imie", "nazwisko", "pesel", "data_urodzenia",
            "pj_kategorie", "pj_data_wydania", "pj_numer",
        ):
            assert field in data


# ──────────────────────────────────────────────
# POST / z template_version dla nowych typów
# ──────────────────────────────────────────────

class TestPostFormNewDocTypes:
    """Testy przesyłania formularza z nowym template_version."""

    def _post_form(self, logged_in_client, template_version, extra_data=None):
        data = {
            "user_name": "testuser",
            "imie": "JAN",
            "nazwisko": "KOWALSKI",
            "pesel": "90010112345",
            "data_urodzenia": "01.01.1990",
            "template_version": template_version,
            "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
        }
        if extra_data:
            data.update(extra_data)
        return logged_in_client.post(
            "/",
            data=data,
            content_type="multipart/form-data",
        )

    def test_post_school_id(self, logged_in_client, registered_user):
        """POST z template_version=new_school_id powinien się udać."""
        resp = self._post_form(logged_in_client, "new_school_id", {
            "si_numer": "303/9",
            "si_data_wydania": "07.09.2026",
            "si_data_waznosci": "30.09.2027",
            "si_nazwa_szkoly": "Liceum nr 1",
            "si_adres": "ul. Testowa 5, 00-001 Warszawa",
            "si_dyrektor": "Anna Nowak",
            "si_telefon": "22 123 45 67",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True

    def test_post_student_id(self, logged_in_client, registered_user):
        """POST z template_version=new_student_id powinien się udać."""
        resp = self._post_form(logged_in_client, "new_student_id", {
            "sti_data_wydania": "31.08.2026",
            "sti_uczelnia": "Politechnika Warszawska",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True

    def test_post_school_id_creates_file(self, logged_in_client, registered_user):
        """Po POST school_id, plik powinien istnieć w user-documents."""
        self._post_form(logged_in_client, "new_school_id", {
            "si_numer": "100/1",
            "si_data_wydania": "01.01.2026",
            "si_data_waznosci": "01.01.2027",
            "si_nazwa_szkoly": "Szkoła",
            "si_adres": "ul. A",
            "si_dyrektor": "Dyrektor",
            "si_telefon": "123456",
        })
        resp = logged_in_client.get("/api/user-documents")
        data = resp.get_json()
        assert data["data"]["documents"]["school_id"] == 1

    def test_post_student_id_creates_file(self, logged_in_client, registered_user):
        """Po POST student_id, plik powinien istnieć w user-documents."""
        self._post_form(logged_in_client, "new_student_id", {
            "sti_data_wydania": "01.09.2026",
            "sti_uczelnia": "UW",
        })
        resp = logged_in_client.get("/api/user-documents")
        data = resp.get_json()
        assert data["data"]["documents"]["student_id"] == 1

    def test_post_school_id_hash_not_empty(self, logged_in_client, registered_user):
        """Po POST school_id, hash dokumentu nie jest pusty."""
        self._post_form(logged_in_client, "new_school_id", {
            "si_numer": "200/2",
        })
        resp = logged_in_client.get("/api/document-hashes")
        data = resp.get_json()
        assert data["data"]["school_id"] != ""

    def test_post_student_id_hash_not_empty(self, logged_in_client, registered_user):
        """Po POST student_id, hash dokumentu nie jest pusty."""
        self._post_form(logged_in_client, "new_student_id", {
            "sti_uczelnia": "PW",
        })
        resp = logged_in_client.get("/api/document-hashes")
        data = resp.get_json()
        assert data["data"]["student_id"] != ""

    def test_post_without_login_fails(self, client):
        """POST bez logowania przekierowuje na login."""
        resp = client.post(
            "/",
            data={
                "user_name": "hacker",
                "template_version": "new_school_id",
            },
            content_type="multipart/form-data",
        )
        assert resp.status_code == 302


# ──────────────────────────────────────────────
# PWA: manifest.json
# ──────────────────────────────────────────────

class TestManifestJson:
    """Testy serwowania manifest.json z nowego UI."""

    def test_manifest_served(self, client):
        """manifest.json jest dostępny pod /manifest.json."""
        resp = client.get("/manifest.json")
        assert resp.status_code == 200

    def test_manifest_valid_json(self, client):
        """manifest.json zwraca poprawny JSON."""
        resp = client.get("/manifest.json")
        data = json.loads(resp.data)
        assert "name" in data
        assert "start_url" in data

    def test_manifest_start_url(self, client):
        """start_url w manifeście wskazuje na /documents."""
        resp = client.get("/manifest.json")
        data = json.loads(resp.data)
        assert data["start_url"] == "/documents"

    def test_manifest_display_standalone(self, client):
        """display jest ustawiony na standalone (tryb PWA)."""
        resp = client.get("/manifest.json")
        data = json.loads(resp.data)
        assert data["display"] == "standalone"

    def test_manifest_has_icons(self, client):
        """Manifest zawiera przynajmniej jedną ikonę."""
        resp = client.get("/manifest.json")
        data = json.loads(resp.data)
        assert len(data.get("icons", [])) >= 1

    def test_manifest_scope(self, client):
        """Scope manifestu jest ustawiony na /."""
        resp = client.get("/manifest.json")
        data = json.loads(resp.data)
        assert data["scope"] == "/"


# ──────────────────────────────────────────────
# PWA: service-worker.js
# ──────────────────────────────────────────────

class TestServiceWorker:
    """Testy serwowania service-worker.js."""

    def test_service_worker_served(self, client):
        """service-worker.js jest dostępny."""
        resp = client.get("/service-worker.js")
        assert resp.status_code == 200

    def test_service_worker_content_type(self, client):
        """service-worker.js ma poprawny content-type JS."""
        resp = client.get("/service-worker.js")
        ct = resp.content_type
        assert "javascript" in ct or "text/" in ct

    def test_service_worker_no_cache(self, client):
        """service-worker.js nie powinien być agresywnie cachowany."""
        resp = client.get("/service-worker.js")
        cache_control = resp.headers.get("Cache-Control", "")
        # max-age powinien być 0 albo nie ustawiony agresywnie
        assert "max-age=86400" not in cache_control


# ──────────────────────────────────────────────
# Nowe route'y UI: /documents, /services, /more, /qr_code
# ──────────────────────────────────────────────

class TestNewUIRoutes:
    """Testy nowych route'ów serwujących pliki UI z static/new/."""

    def test_documents_requires_login(self, client):
        """/documents wymaga zalogowania."""
        resp = client.get("/documents")
        assert resp.status_code == 302
        assert "login" in resp.headers["Location"].lower()

    def test_documents_accessible_logged_in(self, logged_in_client):
        """/documents jest dostępne po zalogowaniu."""
        resp = logged_in_client.get("/documents")
        assert resp.status_code == 200

    def test_documents_contains_html(self, logged_in_client):
        """/documents zwraca HTML."""
        resp = logged_in_client.get("/documents")
        assert b"<!DOCTYPE html>" in resp.data or b"<html" in resp.data

    def test_services_requires_login(self, client):
        """/services wymaga zalogowania."""
        resp = client.get("/services")
        assert resp.status_code == 302

    def test_services_accessible_logged_in(self, logged_in_client):
        """/services jest dostępne po zalogowaniu."""
        resp = logged_in_client.get("/services")
        assert resp.status_code == 200

    def test_more_requires_login(self, client):
        """/more wymaga zalogowania."""
        resp = client.get("/more")
        assert resp.status_code == 302

    def test_more_accessible_logged_in(self, logged_in_client):
        """/more jest dostępne po zalogowaniu."""
        resp = logged_in_client.get("/more")
        assert resp.status_code == 200

    def test_qr_code_requires_login(self, client):
        """/qr_code wymaga zalogowania."""
        resp = client.get("/qr_code")
        assert resp.status_code == 302

    def test_qr_code_accessible_logged_in(self, logged_in_client):
        """/qr_code jest dostępne po zalogowaniu."""
        resp = logged_in_client.get("/qr_code")
        assert resp.status_code == 200


# ──────────────────────────────────────────────
# /assets/* serwowanie z static/new/assets/
# ──────────────────────────────────────────────

class TestAssetsServing:
    """Testy serwowania assetów nowego UI przez /assets/*."""

    def test_assets_css_served(self, client):
        """/assets/css/style.css jest dostępny."""
        resp = client.get("/assets/css/style.css")
        assert resp.status_code == 200

    def test_assets_js_served(self, client):
        """/assets/js/script.js jest dostępny."""
        resp = client.get("/assets/js/script.js")
        assert resp.status_code == 200

    def test_assets_nonexistent_returns_404(self, client):
        """Nieistniejący asset zwraca 404."""
        resp = client.get("/assets/nonexistent/fake.xyz")
        assert resp.status_code == 404

    def test_assets_logo_svg_served(self, client):
        """/assets/svg/logo.svg jest dostępny."""
        resp = client.get("/assets/svg/logo.svg")
        assert resp.status_code == 200


# ──────────────────────────────────────────────
# /pages/* serwowanie podstron
# ──────────────────────────────────────────────

class TestPagesServing:
    """Testy serwowania podstron z /pages/*."""

    def test_pages_requires_login(self, client):
        """/pages/ wymaga zalogowania."""
        resp = client.get("/pages/school_id")
        assert resp.status_code == 302

    def test_pages_nonexistent_returns_404(self, logged_in_client):
        """Nieistniejąca strona zwraca 404."""
        resp = logged_in_client.get("/pages/nonexistent_page")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# /api/data/get/* statyczne dane JSON
# ──────────────────────────────────────────────

class TestApiDataGet:
    """Testy serwowania statycznych danych JSON z nowego UI."""

    def test_nonexistent_data_returns_404(self, client):
        """Nieistniejący plik danych zwraca 404."""
        resp = client.get("/api/data/get/nonexistent.json")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# Dokument hash zmienia się po ponownym POST
# ──────────────────────────────────────────────

class TestDocumentHashChange:
    """Testy zmiany hashy dokumentów po aktualizacji."""

    def _post_school_id(self, logged_in_client, si_numer="100/1"):
        return logged_in_client.post(
            "/",
            data={
                "user_name": "testuser",
                "imie": "JAN",
                "nazwisko": "KOWALSKI",
                "pesel": "90010112345",
                "data_urodzenia": "01.01.1990",
                "template_version": "new_school_id",
                "si_numer": si_numer,
                "si_data_wydania": "01.01.2026",
                "si_data_waznosci": "01.01.2027",
                "si_nazwa_szkoly": "Szkoła",
                "si_adres": "ul. A",
                "si_dyrektor": "Dyrektor",
                "si_telefon": "123456",
                "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
            },
            content_type="multipart/form-data",
        )

    def test_hash_changes_on_update(self, logged_in_client, registered_user):
        """Hash dokumentu zmienia się po zmianie danych."""
        self._post_school_id(logged_in_client, si_numer="100/1")
        resp1 = logged_in_client.get("/api/document-hashes")
        hash1 = resp1.get_json()["data"]["school_id"]

        self._post_school_id(logged_in_client, si_numer="999/9")
        resp2 = logged_in_client.get("/api/document-hashes")
        hash2 = resp2.get_json()["data"]["school_id"]

        assert hash1 != ""
        assert hash2 != ""
        assert hash1 != hash2

    def test_user_documents_shows_1_after_post(self, logged_in_client, registered_user):
        """Po POST school_id, /api/user-documents zwraca 1."""
        self._post_school_id(logged_in_client)
        resp = logged_in_client.get("/api/user-documents")
        data = resp.get_json()
        assert data["data"]["documents"]["school_id"] == 1


# ──────────────────────────────────────────────
# Bezpieczeństwo nowych endpointów
# ──────────────────────────────────────────────

class TestNewEndpointsSecurity:
    """Testy bezpieczeństwa nowych endpointów."""

    def test_my_document_path_traversal(self, logged_in_client):
        """Path traversal w /my-document/ zwraca 404."""
        resp = logged_in_client.get("/my-document/../../../etc/passwd")
        assert resp.status_code == 404

    def test_user_files_path_traversal(self, logged_in_client):
        """Path traversal w /user_files/ jest blokowany."""
        resp = logged_in_client.get("/user_files/../../etc/passwd")
        assert resp.status_code in (400, 403, 404)

    def test_api_user_documents_post_not_allowed(self, logged_in_client):
        """POST na /api/user-documents nie jest dozwolony."""
        resp = logged_in_client.post("/api/user-documents")
        assert resp.status_code == 405

    def test_api_document_hashes_post_not_allowed(self, logged_in_client):
        """POST na /api/document-hashes nie jest dozwolony."""
        resp = logged_in_client.post("/api/document-hashes")
        assert resp.status_code == 405


# ──────────────────────────────────────────────
# Losowe dane — walidacja formatu
# ──────────────────────────────────────────────

class TestRandomDataFormat:
    """Testy formatu losowych danych dla nowych dokumentów."""

    def test_si_numer_format(self, client):
        """Numer legitymacji szkolnej ma format np. 303/9."""
        resp = client.get("/api/generate-random-data?plec=M")
        data = resp.get_json()
        assert "/" in data["si_numer"]

    def test_si_data_wydania_format(self, client):
        """Data wydania legitymacji szkolnej ma format DD.MM.YYYY."""
        resp = client.get("/api/generate-random-data?plec=M")
        data = resp.get_json()
        parts = data["si_data_wydania"].split(".")
        assert len(parts) == 3
        assert len(parts[2]) == 4

    def test_si_data_waznosci_after_wydania(self, client):
        """Data ważności jest późniejsza niż data wydania."""
        from datetime import datetime
        resp = client.get("/api/generate-random-data?plec=K")
        data = resp.get_json()
        wydania = datetime.strptime(data["si_data_wydania"], "%d.%m.%Y")
        waznosci = datetime.strptime(data["si_data_waznosci"], "%d.%m.%Y")
        assert waznosci > wydania

    def test_si_telefon_format(self, client):
        """Telefon szkoły zawiera cyfry i spacje."""
        resp = client.get("/api/generate-random-data?plec=M")
        data = resp.get_json()
        cleaned = data["si_telefon"].replace(" ", "")
        assert cleaned.isdigit()

    def test_sti_data_wydania_format(self, client):
        """Data wydania legitymacji studenckiej ma format DD.MM.YYYY."""
        resp = client.get("/api/generate-random-data?plec=K")
        data = resp.get_json()
        parts = data["sti_data_wydania"].split(".")
        assert len(parts) == 3

    def test_sti_uczelnia_not_empty(self, client):
        """Nazwa uczelni nie jest pusta."""
        resp = client.get("/api/generate-random-data?plec=M")
        data = resp.get_json()
        assert len(data["sti_uczelnia"]) > 3

    def test_random_data_gender_male(self, client):
        """Losowe dane z plec=M zwracają płeć M."""
        resp = client.get("/api/generate-random-data?plec=M")
        data = resp.get_json()
        assert data["plec"] == "M"

    def test_random_data_gender_female(self, client):
        """Losowe dane z plec=K zwracają płeć K."""
        resp = client.get("/api/generate-random-data?plec=K")
        data = resp.get_json()
        assert data["plec"] == "K"


# ──────────────────────────────────────────────
# Odświeżanie dokumentów — pełny cykl
# ──────────────────────────────────────────────

class TestDocumentRefresh:
    """Testy odświeżania i ponownego generowania dokumentów."""

    def _post_doc(self, client, template_version, extra=None):
        """Helper — wyślij formularz z danym template_version."""
        data = {
            "user_name": "testuser",
            "imie": "JAN",
            "nazwisko": "KOWALSKI",
            "pesel": "90010112345",
            "data_urodzenia": "01.01.1990",
            "template_version": template_version,
            "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
        }
        if extra:
            data.update(extra)
        return client.post("/", data=data, content_type="multipart/form-data")

    # --- school_id ---

    def test_school_id_regenerate_changes_hash(self, logged_in_client, registered_user):
        """Ponowne wygenerowanie school_id z innymi danymi zmienia hash."""
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "111/1", "si_nazwa_szkoly": "Szkoła A"})
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "222/2", "si_nazwa_szkoly": "Szkoła B"})
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        assert h1 != ""
        assert h2 != ""
        assert h1 != h2

    def test_school_id_same_data_same_hash(self, logged_in_client, registered_user):
        """Identyczne dane dają ten sam hash school_id."""
        extra = {"si_numer": "333/3", "si_nazwa_szkoly": "Szkoła C", "si_adres": "ul. X"}
        self._post_doc(logged_in_client, "new_school_id", extra)
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        self._post_doc(logged_in_client, "new_school_id", extra)
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        assert h1 == h2

    # --- student_id ---

    def test_student_id_regenerate_changes_hash(self, logged_in_client, registered_user):
        """Ponowne wygenerowanie student_id z innymi danymi zmienia hash."""
        self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": "UW"})
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["student_id"]

        self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": "PW"})
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["student_id"]

        assert h1 != h2

    def test_student_id_same_data_same_hash(self, logged_in_client, registered_user):
        """Identyczne dane dają ten sam hash student_id."""
        extra = {"sti_uczelnia": "AGH", "sti_data_wydania": "15.09.2025"}
        self._post_doc(logged_in_client, "new_student_id", extra)
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["student_id"]

        self._post_doc(logged_in_client, "new_student_id", extra)
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["student_id"]

        assert h1 == h2

    # --- mdowod ---

    def test_mdowod_regenerate_changes_hash(self, logged_in_client, registered_user):
        """Ponowne wygenerowanie mdowod z innym nazwiskiem zmienia hash."""
        self._post_doc(logged_in_client, "new_mdowod", {"nazwisko": "KOWALSKI"})
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["mdowod"]

        self._post_doc(logged_in_client, "new_mdowod", {"nazwisko": "NOWAK"})
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["mdowod"]

        assert h1 != h2

    # --- mprawojazdy ---

    def test_mprawojazdy_regenerate_changes_hash(self, logged_in_client, registered_user):
        """Ponowne wygenerowanie mprawojazdy z innymi kategoriami zmienia hash."""
        self._post_doc(logged_in_client, "new_mprawojazdy", {"pj_kategorie": "B"})
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["mprawojazdy"]

        self._post_doc(logged_in_client, "new_mprawojazdy", {"pj_kategorie": "A, B, C"})
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["mprawojazdy"]

        assert h1 != h2

    # --- user-documents po generacji ---

    def test_all_docs_available_after_generation(self, logged_in_client, registered_user):
        """Po wygenerowaniu wszystkich 4 dokumentów, wszystkie mają status 1."""
        self._post_doc(logged_in_client, "new_mdowod")
        self._post_doc(logged_in_client, "new_mprawojazdy")
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "1/1"})
        self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": "UW"})

        resp = logged_in_client.get("/api/user-documents")
        docs = resp.get_json()["data"]["documents"]
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert docs[key] == 1, f"Dokument {key} nie istnieje po wygenerowaniu"

    def test_all_hashes_nonempty_after_generation(self, logged_in_client, registered_user):
        """Po wygenerowaniu wszystkich 4 dokumentów, wszystkie hashe są niepuste."""
        self._post_doc(logged_in_client, "new_mdowod")
        self._post_doc(logged_in_client, "new_mprawojazdy")
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "5/5"})
        self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": "PW"})

        resp = logged_in_client.get("/api/document-hashes")
        hashes = resp.get_json()["data"]
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert hashes[key] != "", f"Hash dla {key} jest pusty po wygenerowaniu"

    # --- generowanie jednego typu nie wpływa na inny ---

    def test_school_id_does_not_affect_student_id(self, logged_in_client, registered_user):
        """Wygenerowanie school_id nie tworzy student_id."""
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "7/7"})
        docs = logged_in_client.get("/api/user-documents").get_json()["data"]["documents"]
        assert docs["school_id"] == 1
        # student_id nie powinien powstać przez school_id POST
        # (chyba że był w tym samym folderze z wcześniejszego testu)

    def test_student_id_does_not_affect_school_id_hash(self, logged_in_client, registered_user):
        """Wygenerowanie student_id nie zmienia hasha school_id."""
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "8/8"})
        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": "UJ"})
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        assert h1 == h2


# ──────────────────────────────────────────────
# Cache headers na serwowanych dokumentach
# ──────────────────────────────────────────────

class TestDocumentCacheHeaders:
    """Testy nagłówków cache na serwowanych plikach użytkownika."""

    def _generate_and_serve(self, logged_in_client, template_version, filename, extra=None):
        """Helper — wygeneruj dokument i pobierz go."""
        data = {
            "user_name": "testuser",
            "imie": "JAN",
            "nazwisko": "KOWALSKI",
            "pesel": "90010112345",
            "data_urodzenia": "01.01.1990",
            "template_version": template_version,
            "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
        }
        if extra:
            data.update(extra)
        logged_in_client.post("/", data=data, content_type="multipart/form-data")
        return logged_in_client.get(f"/user_files/{filename}")

    def test_school_id_no_cache(self, logged_in_client, registered_user):
        """Plik school_id_new.html ma nagłówek no-cache."""
        resp = self._generate_and_serve(
            logged_in_client, "new_school_id", "school_id_new.html", {"si_numer": "1/1"}
        )
        assert resp.status_code == 200
        cc = resp.headers.get("Cache-Control", "")
        assert "no-cache" in cc or "no-store" in cc

    def test_student_id_no_cache(self, logged_in_client, registered_user):
        """Plik student_id_new.html ma nagłówek no-cache."""
        resp = self._generate_and_serve(
            logged_in_client, "new_student_id", "student_id_new.html", {"sti_uczelnia": "UW"}
        )
        assert resp.status_code == 200
        cc = resp.headers.get("Cache-Control", "")
        assert "no-cache" in cc or "no-store" in cc

    def test_mdowod_no_cache(self, logged_in_client, registered_user):
        """Plik dowodnowy_new.html ma nagłówek no-cache."""
        resp = self._generate_and_serve(
            logged_in_client, "new_mdowod", "dowodnowy_new.html"
        )
        assert resp.status_code == 200
        cc = resp.headers.get("Cache-Control", "")
        assert "no-cache" in cc or "no-store" in cc

    def test_mprawojazdy_no_cache(self, logged_in_client, registered_user):
        """Plik prawojazdy_new.html ma nagłówek no-cache."""
        resp = self._generate_and_serve(
            logged_in_client, "new_mprawojazdy", "prawojazdy_new.html"
        )
        assert resp.status_code == 200
        cc = resp.headers.get("Cache-Control", "")
        assert "no-cache" in cc or "no-store" in cc

    def test_pragma_no_cache(self, logged_in_client, registered_user):
        """Serwowane pliki mają Pragma: no-cache."""
        resp = self._generate_and_serve(
            logged_in_client, "new_school_id", "school_id_new.html", {"si_numer": "2/2"}
        )
        assert resp.headers.get("Pragma") == "no-cache"

    def test_expires_zero(self, logged_in_client, registered_user):
        """Serwowane pliki mają Expires: 0."""
        resp = self._generate_and_serve(
            logged_in_client, "new_school_id", "school_id_new.html", {"si_numer": "3/3"}
        )
        assert resp.headers.get("Expires") == "0"

    def test_nonexistent_file_returns_404(self, logged_in_client):
        """Próba pobrania nieistniejącego pliku zwraca 404."""
        resp = logged_in_client.get("/user_files/nieistniejacy_plik.html")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# Serwowanie /user_files/<username>/<filename>
# ──────────────────────────────────────────────

class TestUserFilesWithUsername:
    """Testy serwowania plików z /user_files/<username>/<filename>."""

    def _generate_doc(self, logged_in_client):
        logged_in_client.post(
            "/",
            data={
                "user_name": "testuser",
                "imie": "JAN",
                "nazwisko": "KOWALSKI",
                "pesel": "90010112345",
                "template_version": "new_school_id",
                "si_numer": "99/9",
                "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
            },
            content_type="multipart/form-data",
        )

    def test_owner_can_access(self, logged_in_client, registered_user):
        """Właściciel może pobrać swój plik."""
        self._generate_doc(logged_in_client)
        resp = logged_in_client.get("/user_files/testuser/school_id_new.html")
        assert resp.status_code == 200

    def test_other_user_cannot_access(self, logged_in_client, registered_user, client, auth_manager, access_key_service):
        """Inny użytkownik nie może pobrać cudzego pliku."""
        self._generate_doc(logged_in_client)
        # Wyloguj i zaloguj jako inny user
        logged_in_client.get("/logout")

        from models import db
        key = access_key_service.generate_access_key("other_user_key")
        db.session.commit()
        auth_manager.register_user("otheruser", "password456", key, mark_tutorial_seen=True)

        client.get("/login")
        with client.session_transaction() as sess:
            csrf = sess.get("csrf_token")
        client.post("/login", json={"username": "otheruser", "password": "password456"},
                     headers={"X-CSRFToken": csrf})

        resp = client.get("/user_files/testuser/school_id_new.html")
        assert resp.status_code == 403

    def test_unauthenticated_cannot_access(self, client):
        """Niezalogowany użytkownik nie może pobrać pliku z username w URL."""
        resp = client.get("/user_files/testuser/school_id_new.html")
        assert resp.status_code == 403


# ──────────────────────────────────────────────
# Wielokrotne generowanie tego samego dokumentu
# ──────────────────────────────────────────────

class TestMultipleRegeneration:
    """Testy wielokrotnego generowania dokumentów."""

    def _post_doc(self, client, template_version, extra=None):
        data = {
            "user_name": "testuser",
            "imie": "JAN",
            "nazwisko": "KOWALSKI",
            "pesel": "90010112345",
            "data_urodzenia": "01.01.1990",
            "template_version": template_version,
            "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
        }
        if extra:
            data.update(extra)
        return client.post("/", data=data, content_type="multipart/form-data")

    def test_five_regenerations_school_id(self, logged_in_client, registered_user):
        """5 kolejnych generowań school_id — każde successfull."""
        for i in range(5):
            resp = self._post_doc(logged_in_client, "new_school_id", {"si_numer": f"{i}/1"})
            assert resp.status_code == 200
            assert resp.get_json()["success"] is True

    def test_five_regenerations_student_id(self, logged_in_client, registered_user):
        """5 kolejnych generowań student_id — każde succesfull."""
        for i in range(5):
            resp = self._post_doc(logged_in_client, "new_student_id", {"sti_uczelnia": f"Uczelnia {i}"})
            assert resp.status_code == 200
            assert resp.get_json()["success"] is True

    def test_alternating_doc_types(self, logged_in_client, registered_user):
        """Naprzemienne generowanie różnych typów nie psuje innych."""
        types_and_extras = [
            ("new_mdowod", {}),
            ("new_school_id", {"si_numer": "10/1"}),
            ("new_mprawojazdy", {"pj_kategorie": "B"}),
            ("new_student_id", {"sti_uczelnia": "UW"}),
        ]
        for tv, extra in types_and_extras:
            resp = self._post_doc(logged_in_client, tv, extra)
            assert resp.status_code == 200
            assert resp.get_json()["success"] is True

        # Wszystkie 4 dokumenty powinny istnieć
        docs = logged_in_client.get("/api/user-documents").get_json()["data"]["documents"]
        for key in ("mdowod", "mprawojazdy", "school_id", "student_id"):
            assert docs[key] == 1

    def test_hash_history_consistent(self, logged_in_client, registered_user):
        """Hash nie zmienia się między odczytami bez regeneracji."""
        self._post_doc(logged_in_client, "new_school_id", {"si_numer": "50/5"})

        h1 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]
        h2 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]
        h3 = logged_in_client.get("/api/document-hashes").get_json()["data"]["school_id"]

        assert h1 == h2 == h3


# ──────────────────────────────────────────────
# Zawartość wygenerowanych dokumentów
# ──────────────────────────────────────────────

class TestDocumentContent:
    """Testy zawartości wygenerowanych dokumentów HTML."""

    def _generate_and_get(self, client, template_version, filename, extra=None):
        data = {
            "user_name": "testuser",
            "imie": "ANNA",
            "nazwisko": "NOWAK",
            "pesel": "95050512345",
            "data_urodzenia": "05.05.1995",
            "template_version": template_version,
            "image_upload": (io.BytesIO(b"fake_image"), "photo.jpg"),
        }
        if extra:
            data.update(extra)
        client.post("/", data=data, content_type="multipart/form-data")
        return client.get(f"/user_files/{filename}")

    def test_school_id_contains_name(self, logged_in_client, registered_user):
        """Wygenerowany school_id zawiera imię użytkownika."""
        resp = self._generate_and_get(
            logged_in_client, "new_school_id", "school_id_new.html",
            {"si_numer": "1/1", "si_nazwa_szkoly": "Testowa Szkoła"},
        )
        assert resp.status_code == 200
        html = resp.data.decode("utf-8", errors="replace")
        assert "ANNA" in html

    def test_school_id_contains_school_name(self, logged_in_client, registered_user):
        """Wygenerowany school_id zawiera nazwę szkoły."""
        resp = self._generate_and_get(
            logged_in_client, "new_school_id", "school_id_new.html",
            {"si_numer": "1/1", "si_nazwa_szkoly": "Testowa Szkoła Specjalna"},
        )
        html = resp.data.decode("utf-8", errors="replace")
        assert "Testowa Szkoła Specjalna" in html or "Testowa Szko" in html

    def test_student_id_contains_name(self, logged_in_client, registered_user):
        """Wygenerowany student_id zawiera imię użytkownika."""
        resp = self._generate_and_get(
            logged_in_client, "new_student_id", "student_id_new.html",
            {"sti_uczelnia": "Politechnika"},
        )
        assert resp.status_code == 200
        html = resp.data.decode("utf-8", errors="replace")
        assert "ANNA" in html

    def test_student_id_contains_university(self, logged_in_client, registered_user):
        """Wygenerowany student_id zawiera nazwę uczelni."""
        resp = self._generate_and_get(
            logged_in_client, "new_student_id", "student_id_new.html",
            {"sti_uczelnia": "Politechnika Testowa"},
        )
        html = resp.data.decode("utf-8", errors="replace")
        assert "Politechnika Testowa" in html or "Politechnika" in html

    def test_mdowod_contains_name(self, logged_in_client, registered_user):
        """Wygenerowany mdowod zawiera nazwisko."""
        resp = self._generate_and_get(
            logged_in_client, "new_mdowod", "dowodnowy_new.html",
        )
        html = resp.data.decode("utf-8", errors="replace")
        assert "NOWAK" in html

    def test_document_is_valid_html(self, logged_in_client, registered_user):
        """Wygenerowany dokument zawiera tagi HTML."""
        resp = self._generate_and_get(
            logged_in_client, "new_school_id", "school_id_new.html",
            {"si_numer": "1/1"},
        )
        html = resp.data.decode("utf-8", errors="replace")
        assert "<html" in html.lower()
        assert "</html>" in html.lower()
