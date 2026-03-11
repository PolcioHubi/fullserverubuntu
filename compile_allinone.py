#!/usr/bin/env python3
"""
All-in-One HTML Compiler for mObywatel PWA
===========================================
Kompiluje 5 stron HTML z static/new/ (login, documents, services, qr_code, more)
w jeden wielki SPA HTML. Wszystkie assety (CSS, JS, SVG, PNG, fonty) są inline'owane
jako Base64. Nawigacja między stronami działa przez wbudowany SPA router (show/hide).
Komunikacja z serwerem (chat, powiadomienia, logowanie) pozostaje via AJAX.

Użycie:
    python compile_allinone.py
    python compile_allinone.py --output moj_plik.html
    python compile_allinone.py --verbose
"""

import os
import re
import sys
import json
import base64
import hashlib
import argparse
import mimetypes
from pathlib import Path
from collections import OrderedDict

try:
    from bs4 import BeautifulSoup, Comment
except ImportError:
    print("BŁĄD: Brak modułu beautifulsoup4. Zainstaluj: pip install beautifulsoup4")
    sys.exit(1)

# ============================================================================
# SEKCJA A — Konfiguracja i narzędzia
# ============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()
STATIC_NEW = SCRIPT_DIR / "static" / "new"
ASSETS_DIR = STATIC_NEW / "assets"
DEFAULT_OUTPUT = STATIC_NEW / "allinone.html"

# Strony do zmergowania: (nazwa_sekcji, plik_html)
PAGES = OrderedDict([
    ("login", STATIC_NEW / "login.html"),
    ("documents", STATIC_NEW / "documents.html"),
    ("services", STATIC_NEW / "services.html"),
    ("qr_code", STATIC_NEW / "qr_code.html"),
    ("more", STATIC_NEW / "more.html"),
])

# Skrypty do pominięcia (zbędne w all-in-one)
SKIP_SCRIPTS = {
    "worker-starter.js",
}

# Dodatkowe skrypty, które nie są ładowane w <script src> ale są potrzebne
# (skrypty dokumentów ładowane w wygenerowanych stronach user-files,
#  oraz vendor libraries)
EXTRA_SCRIPTS = [
    "/assets/js/vendor/zxing.min.js",
    "/assets/js/pages/documents/mdowod.js",
    "/assets/js/pages/documents/mprawojazdy.js",
    "/assets/js/pages/documents/school_id.js",
    "/assets/js/pages/documents/student_id.js",
]

# Mapa dokumentów użytkownika: klucz → nazwa pliku generowanego
USER_DOC_MAP = OrderedDict([
    ("mdowod", "dowodnowy_new.html"),
    ("mprawojazdy", "prawojazdy_new.html"),
    ("school_id", "school_id_new.html"),
    ("student_id", "student_id_new.html"),
])

# Mapowanie pól z polskiego formularza (last_form_data.json) na format /api/data/get/details
FORM_FIELD_MAP = {
    "mdowod": {
        "main": {
            "first_name": "imie",
            "last_name": "nazwisko",
            "birthday": "data_urodzenia",
            "pesel": "pesel",
        },
        "personal": {
            "series": "seria_numer_dowodu",
            "issuer": "organ_wydajacy_dowodu",
            "expiration": "termin_waznosci_dowodu",
            "issue": "data_wydania_dowodu",
        },
        "other": {
            "series": "seria_numer_mdowodu",
            "expiration": "termin_waznosci_mdowodu",
            "issue": "data_wydania_mdowodu",
            "fathers_name": "imie_ojca_mdowod",
            "mothers_name": "imie_matki_mdowod",
        },
        "additional": {
            "family_name": "nazwisko_rodowe",
            "fathers_family": "nazwisko_rodowe_ojca",
            "mothers_family": "nazwisko_rodowe_matki",
            "place_of_birth": "miejsce_urodzenia",
            "residence": "adres_zameldowania",
            "residence_date": "data_zameldowania",
        },
    },
    "mprawojazdy": {
        "main": {
            "first_name": "imie",
            "last_name": "nazwisko",
            "birthdate": "data_urodzenia",
            "pesel": "pesel",
            "categories": "pj_kategorie",
        },
        "other": {
            "issue": "pj_data_wydania",
            "number": "pj_numer",
            "blank": "pj_blankiet",
            "issuer": "pj_organ",
            "restrictions": "pj_ograniczenia",
        },
    },
    "school": {
        "main": {
            "first_name": "imie",
            "last_name": "nazwisko",
            "birthdate": "data_urodzenia",
            "pesel": "pesel",
            "number": "si_numer",
        },
        "other": {
            "issue": "si_data_wydania",
            "expiration": "si_data_waznosci",
            "name": "si_nazwa_szkoly",
            "address": "si_adres",
            "principal": "si_dyrektor",
            "phone": "si_telefon",
        },
    },
    "student": {
        "main": {
            "first_name": "imie",
            "last_name": "nazwisko",
            "birthday": "data_urodzenia",
            "pesel": "pesel",
            "issue": "sti_data_wydania",
            "university": "sti_uczelnia",
        },
        "other": {},
    },
}

# Rozszerzenia MIME
MIME_MAP = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".css": "text/css",
    ".js": "application/javascript",
}

VERBOSE = False


def log(msg, level="INFO"):
    colors = {"INFO": "\033[36m", "WARN": "\033[33m", "ERROR": "\033[31m", "OK": "\033[32m"}
    reset = "\033[0m"
    prefix = colors.get(level, "")
    print(f"{prefix}[{level}]{reset} {msg}")


def log_verbose(msg):
    if VERBOSE:
        log(msg, "INFO")


def get_mime(filepath):
    ext = Path(filepath).suffix.lower()
    return MIME_MAP.get(ext, mimetypes.guess_type(str(filepath))[0] or "application/octet-stream")


def file_to_base64(filepath):
    """Konwertuje plik binarny na data URI."""
    filepath = Path(filepath)
    if not filepath.exists():
        log(f"Nie znaleziono pliku: {filepath}", "WARN")
        return ""
    mime = get_mime(filepath)
    with open(filepath, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{data}"


def read_text(filepath, encoding="utf-8"):
    """Czyta plik tekstowy."""
    filepath = Path(filepath)
    if not filepath.exists():
        log(f"Nie znaleziono pliku: {filepath}", "WARN")
        return ""
    with open(filepath, "r", encoding=encoding, errors="replace") as f:
        return f.read()


def resolve_path(base_dir, ref_path):
    """Rozwiązuje ścieżkę assetu relatywną lub absolutną (/assets/...) do ścieżki na dysku."""
    ref_path = ref_path.strip().split("?")[0].split("#")[0]  # Usuń query string
    if not ref_path or ref_path.startswith("data:") or ref_path.startswith("http"):
        return None
    if ref_path.startswith("/assets/"):
        return STATIC_NEW / ref_path.lstrip("/")
    if ref_path.startswith("/"):
        return STATIC_NEW / ref_path.lstrip("/")
    resolved = (Path(base_dir) / ref_path).resolve()
    return resolved


# ============================================================================
# SEKCJA B — CSS Resolver
# ============================================================================

class CSSResolver:
    def __init__(self):
        self._visited = set()
        self._stats = {"files": 0, "imports_resolved": 0, "urls_inlined": 0}

    def resolve(self, css_file):
        """Rekursywnie rozwija @import i zamienia url() na Base64."""
        css_file = Path(css_file).resolve()
        if css_file in self._visited:
            return ""
        self._visited.add(css_file)

        if not css_file.exists():
            log(f"CSS nie znaleziony: {css_file}", "WARN")
            return ""

        self._stats["files"] += 1
        log_verbose(f"CSS: {css_file.name}")

        content = read_text(css_file)
        base_dir = css_file.parent

        # Rozwiń @import url(...)
        content = self._resolve_imports(content, base_dir)

        # Zamień url(...) na Base64
        content = self._inline_urls(content, base_dir)

        return content

    def _resolve_imports(self, css, base_dir):
        """Zamienia @import url(...) na zawartość importowanego pliku."""
        def replace_import(match):
            url = match.group(1) or match.group(2) or match.group(3)
            if not url or url.startswith("http"):
                return match.group(0)  # Zachowaj import zewnętrznych stylów
            resolved = resolve_path(base_dir, url)
            if resolved and resolved.exists():
                self._stats["imports_resolved"] += 1
                return self.resolve(resolved)
            log(f"Import CSS nie znaleziony: {url} (z {base_dir})", "WARN")
            return ""

        # Dopasuj: @import url("..."), @import url(...), @import "..."
        pattern = r'@import\s+url\(["\']?([^"\')\s]+)["\']?\)\s*;|@import\s+url\(([^)]+)\)\s*;|@import\s+["\']([^"\']+)["\']\s*;'
        return re.sub(pattern, replace_import, css)

    def _inline_urls(self, css, base_dir):
        """Zamienia url(...) referencje na data URI w CSS."""
        def replace_url(match):
            prefix = match.group(1)
            url = match.group(2).strip("'\"")
            suffix = match.group(3)

            if not url or url.startswith("data:") or url.startswith("http"):
                return match.group(0)

            resolved = resolve_path(base_dir, url)
            if resolved and resolved.exists():
                self._stats["urls_inlined"] += 1
                data_uri = file_to_base64(resolved)
                return f"{prefix}{data_uri}{suffix}"

            log(f"URL w CSS nie znaleziony: {url} (z {base_dir})", "WARN")
            return match.group(0)

        # Dopasuj url(...) ale nie te już zinline'owane
        pattern = r'(url\(["\']?)([^"\')\s]+)(["\']?\))'
        return re.sub(pattern, replace_url, css)

    @property
    def stats(self):
        return dict(self._stats)


# ============================================================================
# SEKCJA C — JS Resolver
# ============================================================================

class JSResolver:
    def __init__(self):
        self._visited = set()
        self._stats = {"files": 0, "assets_inlined": 0}

    def resolve_scripts(self, script_refs):
        """Czyta listę plików JS, deduplikuje, inline'uje assety w stringach."""
        result = []
        for src in script_refs:
            # Sprawdź, czy pominąć
            basename = Path(src).name.split("?")[0]
            if basename in SKIP_SCRIPTS:
                log_verbose(f"JS pominięty: {basename}")
                continue

            filepath = resolve_path(STATIC_NEW, src)
            if not filepath:
                continue

            filepath = Path(filepath).resolve()
            if filepath in self._visited:
                continue
            self._visited.add(filepath)

            if not filepath.exists():
                log(f"JS nie znaleziony: {filepath}", "WARN")
                continue

            self._stats["files"] += 1
            log_verbose(f"JS: {filepath.name}")

            content = read_text(filepath)
            content = self._inline_asset_urls(content)
            result.append((basename, content))

        return result

    def _inline_asset_urls(self, js_code):
        """Zamienia stringi URL assetów w JS na Base64 data URI."""
        def replace_asset_string(match):
            quote = match.group(1)
            url_path = match.group(2)

            resolved = resolve_path(STATIC_NEW, url_path)
            if resolved and resolved.exists():
                self._stats["assets_inlined"] += 1
                data_uri = file_to_base64(resolved)
                return f"{quote}{data_uri}{quote}"

            return match.group(0)

        # Dopasuj '/assets/...' i "/assets/..." w JS (dowolna ścieżka pod /assets/)
        pattern = r"""(['"])(/assets/[^'"]+)\1"""
        return re.sub(pattern, replace_asset_string, js_code)

    @property
    def stats(self):
        return dict(self._stats)


# ============================================================================
# SEKCJA D — HTML Parser
# ============================================================================

class PageParser:
    def __init__(self, css_resolver, js_resolver):
        self.css_resolver = css_resolver
        self.js_resolver = js_resolver
        self._all_css_refs = []
        self._all_js_refs = []
        self._external_css = []  # Google Fonts itp.
        self._stats = {"pages": 0, "images_inlined": 0}

    def parse_page(self, html_file, page_name):
        """Parsuje stronę HTML i zwraca body HTML z zinlineowanymi obrazami."""
        html_file = Path(html_file)
        if not html_file.exists():
            log(f"Strona nie znaleziona: {html_file}", "ERROR")
            return ""

        self._stats["pages"] += 1
        log(f"Parsowanie strony: {page_name} ({html_file.name})")

        soup = BeautifulSoup(read_text(html_file), "html.parser")

        # Zbierz CSS refs
        for link in soup.find_all("link", rel="stylesheet"):
            href = link.get("href", "")
            if href and href.startswith("http"):
                # Zewnętrzny CSS (Google Fonts) — zachowaj jako link
                if href not in self._external_css:
                    self._external_css.append(href)
            elif href:
                if href not in self._all_css_refs:
                    self._all_css_refs.append(href)

        # Zbierz JS refs
        for script in soup.find_all("script", src=True):
            src = script["src"]
            if src not in self._all_js_refs:
                self._all_js_refs.append(src)

        # Wyciągnij body
        body = soup.find("body")
        if not body:
            log(f"Brak <body> w {html_file.name}", "ERROR")
            return ""

        # Zbierz klasy body
        body_classes = " ".join(body.get("class", []))

        # Inline'uj obrazy w body
        self._inline_images(body)
        self._inline_style_urls(body)

        # Zamień anchory nawigacji na SPA linki
        self._patch_navigation_links(body, page_name)

        # Zwróć body HTML owinięte w sekcję
        inner = body.decode_contents()
        return (
            f'<div data-page="{page_name}" class="page-section {body_classes}" '
            f'style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;">\n'
            f'{inner}\n</div>\n'
        )

    def _inline_images(self, element):
        """Zamienia <img src="/assets/..."> na Base64 data URI."""
        for img in element.find_all("img"):
            src = img.get("src", "")
            if src and not src.startswith("data:") and not src.startswith("http"):
                resolved = resolve_path(STATIC_NEW, src)
                if resolved and resolved.exists():
                    img["src"] = file_to_base64(resolved)
                    self._stats["images_inlined"] += 1
                else:
                    log_verbose(f"Obraz nie znaleziony: {src}")

    def _inline_style_urls(self, element):
        """Zamienia url(...) w inline style atrybutach na Base64."""
        for tag in element.find_all(style=True):
            style = tag["style"]
            if "url(" in style:
                tag["style"] = self._replace_style_urls(style)

    def _replace_style_urls(self, style_str):
        """Zamienia url('/assets/...') w stringu stylu na data URI."""
        def replace_url(match):
            url = match.group(1).strip("'\"")
            if url.startswith("data:") or url.startswith("http"):
                return match.group(0)
            resolved = resolve_path(STATIC_NEW, url)
            if resolved and resolved.exists():
                self._stats["images_inlined"] += 1
                return f"url('{file_to_base64(resolved)}')"
            return match.group(0)

        return re.sub(r"url\(([^)]+)\)", replace_url, style_str)

    def _patch_navigation_links(self, body, current_page):
        """Dodaje data-spa-nav atrybuty do głównych linków nawigacyjnych."""
        nav_map = {
            "/documents": "documents",
            "/services": "services",
            "/qr_code": "qr_code",
            "/more": "more",
            "/static/new/documents.html": "documents",
            "/static/new/services.html": "services",
            "/static/new/qr_code.html": "qr_code",
            "/static/new/more.html": "more",
            "/static/new/login.html": "login",
        }
        for a_tag in body.find_all("a", href=True):
            href = a_tag["href"].split("?")[0]
            if href in nav_map:
                a_tag["data-spa-nav"] = nav_map[href]
                a_tag["href"] = f"#{nav_map[href]}"

    @property
    def css_refs(self):
        return list(self._all_css_refs)

    @property
    def external_css(self):
        return list(self._external_css)

    @property
    def js_refs(self):
        return list(self._all_js_refs)

    @property
    def stats(self):
        return dict(self._stats)


# ============================================================================
# SEKCJA E — SPA Router Generator
# ============================================================================

def generate_spa_router(selected_docs=None, is_per_user=False):
    """Generuje kod JS routera SPA, który zarządza przełączaniem sekcji."""
    # Dynamicznie rozszerz PAGE_NAMES i NAV_MAP o viewer pages
    viewer_pages_js = ""
    viewer_nav_entries = ""
    viewer_init_cases = ""
    if is_per_user and selected_docs:
        viewer_names = [f"'{doc}_viewer'" for doc in selected_docs]
        viewer_pages_js = ", " + ", ".join(viewer_names)

        entries = []
        for doc in selected_docs:
            entries.append(f"        'my-document/{doc}': '{doc}_viewer'")
            entries.append(f"        '/my-document/{doc}': '{doc}_viewer'")
            entries.append(f"        '{doc}_viewer': '{doc}_viewer'")
        viewer_nav_entries = ",\n" + ",\n".join(entries) + ","

        # initPageManager case'y dla viewer pages
        cases = []
        manager_map = {
            "mdowod": "mdowodManager",
            "mprawojazdy": "mprawojazdyManager",
            "school_id": "schoolIDManager",
            "student_id": "studentIDManager",
        }
        for doc in selected_docs:
            mgr = manager_map.get(doc, "")
            if mgr:
                cases.append(f"""                case '{doc}_viewer':
                    if (typeof {mgr} !== 'undefined') {{
                        {mgr}.initialized = false;
                        {mgr}.init();
                    }}
                    startSubscriptionCheck();
                    break;""")
        viewer_init_cases = "\n" + "\n".join(cases)

    return f"""
// ============================================================================
// ALL-IN-ONE SPA ROUTER
// ============================================================================
(function() {{
    'use strict';

    const PAGE_NAMES = ['login', 'documents', 'services', 'qr_code', 'more'{viewer_pages_js}];
    const NAV_MAP = {{
        '/documents': 'documents',
        '/services': 'services',
        '/qr_code': 'qr_code',
        '/more': 'more',
        '/static/new/documents.html': 'documents',
        '/static/new/services.html': 'services',
        '/static/new/qr_code.html': 'qr_code',
        '/static/new/more.html': 'more',
        '/static/new/login.html': 'login',
        'documents': 'documents',
        'services': 'services',
        'qr_code': 'qr_code',
        'more': 'more',
        'login': 'login'{viewer_nav_entries}
    }};

    let _activeIntervals = [];
    let _currentPage = null;

    const _origSetInterval = window.setInterval.bind(window);
    const _origClearInterval = window.clearInterval.bind(window);
    const _origSetTimeout = window.setTimeout.bind(window);
    const _origClearTimeout = window.clearTimeout.bind(window);

    window._spaActiveTimers = [];
    const _trackingEnabled = {{ value: false }};

    const _origSI = window.setInterval;
    window.setInterval = function() {{
        const id = _origSI.apply(window, arguments);
        if (_trackingEnabled.value) {{
            window._spaActiveTimers.push({{ type: 'interval', id: id }});
        }}
        return id;
    }};
    const _origSTO = window.setTimeout;
    window.setTimeout = function() {{
        const id = _origSTO.apply(window, arguments);
        if (_trackingEnabled.value) {{
            window._spaActiveTimers.push({{ type: 'timeout', id: id }});
        }}
        return id;
    }};

    function clearTrackedTimers() {{
        window._spaActiveTimers.forEach(function(t) {{
            if (t.type === 'interval') _origClearInterval(t.id);
            else _origClearTimeout(t.id);
        }});
        window._spaActiveTimers = [];
    }}

    function resolvePageName(input) {{
        if (!input) return null;
        if (input.charAt(0) === '#') input = input.substring(1);
        input = input.split('?')[0].split('#')[0];
        if (NAV_MAP[input]) return NAV_MAP[input];
        for (var key in NAV_MAP) {{
            if (input.indexOf(key) !== -1) return NAV_MAP[key];
        }}
        return null;
    }}

    function getAllSections() {{
        return document.querySelectorAll('.page-section[data-page]');
    }}

    function showPage(pageName, pushState) {{
        if (typeof pushState === 'undefined') pushState = true;

        var resolved = resolvePageName(pageName);
        if (!resolved || resolved === _currentPage) return;

        clearTrackedTimers();
        stopPageIntervals();

        getAllSections().forEach(function(sec) {{
            sec.style.display = 'none';
        }});

        var target = document.querySelector('.page-section[data-page="' + resolved + '"]');
        if (target) {{
            target.style.display = '';
            target.style.opacity = '0';
            target.style.transform = 'translateY(6px)';
            requestAnimationFrame(function() {{
                target.style.transition = 'opacity 160ms ease, transform 160ms ease';
                target.style.opacity = '1';
                target.style.transform = 'translateY(0)';
            }});
        }}

        _currentPage = resolved;
        window._currentPage = resolved;
        window._spaActiveSection = target;

        if (pushState) {{
            try {{
                history.pushState({{ page: resolved }}, '', '#' + resolved);
            }} catch(e) {{}}
        }}

        updateActiveTab(resolved);
        _trackingEnabled.value = true;
        initPageManager(resolved);

        console.log('[SPA Router] Przełączono na:', resolved);
    }}

    function updateActiveTab(pageName) {{
        // Dla viewer pages — aktywuj tab "documents"
        var tabName = pageName;
        if (pageName.indexOf('_viewer') !== -1) tabName = 'documents';

        document.querySelectorAll('.page-section[data-page] a[data-spa-nav]').forEach(function(a) {{
            var navTarget = a.getAttribute('data-spa-nav');
            var img = a.querySelector('img');
            if (!img) return;
            var src = img.getAttribute('src') || img.getAttribute('data-original-src') || '';

            if (!img.getAttribute('data-original-src')) {{
                img.setAttribute('data-original-src', src);
            }}

            var spans = a.querySelectorAll('span');

            if (navTarget === tabName) {{
                spans.forEach(function(s) {{ s.classList.add('active'); }});
                a.classList.add('nav-active');
            }} else {{
                spans.forEach(function(s) {{ s.classList.remove('active'); }});
                a.classList.remove('nav-active');
            }}
        }});
    }}

    var _docPollInterval = null;
    var _subCheckInterval = null;

    function stopPageIntervals() {{
        if (_docPollInterval) {{ clearInterval(_docPollInterval); _docPollInterval = null; }}
        if (_subCheckInterval) {{ clearInterval(_subCheckInterval); _subCheckInterval = null; }}
    }}

    function startDocumentPolling() {{
        if (_docPollInterval) return;

        var poll = function() {{
            $.ajax({{
                url: '/api/user-documents',
                data: {{ _ts: Date.now() }},
                dataType: 'json',
                success: function(response) {{
                    if (response.success) {{
                        var docs = response.data.documents || {{}};
                        window._lastDocData = docs;
                        window._docAvailability = docs;
                        if (typeof window._updateDocumentCards === 'function') window._updateDocumentCards();
                        try {{ localStorage.setItem('doc_availability_cache', JSON.stringify({{ savedAt: Date.now(), documents: docs }})); }} catch(e) {{}}
                    }}
                }},
                error: function() {{
                    if (_docPollInterval) {{ clearInterval(_docPollInterval); _docPollInterval = null; }}
                }}
            }});
        }};
        poll();
        _docPollInterval = setInterval(poll, 10000);
    }}

    function startSubscriptionCheck() {{
        if (_subCheckInterval) return;
        _subCheckInterval = setInterval(function() {{
            $.ajax({{
                url: '/api/data/get/subscription',
                dataType: 'json',
                success: function(resp) {{
                    if (!resp.success) {{
                        stopPageIntervals();
                        showPage('login');
                    }}
                }},
                error: function() {{
                    stopPageIntervals();
                }}
            }});
        }}, 30000);
    }}

    function initPageManager(pageName) {{
        console.log('[SPA] initPageManager:', pageName);
        try {{
            switch(pageName) {{
                case 'documents':
                    if (typeof documentsManager !== 'undefined') documentsManager.init();
                    startDocumentPolling();
                    startSubscriptionCheck();
                    break;
                case 'services':
                    if (typeof servicesManager !== 'undefined') servicesManager.init();
                    startSubscriptionCheck();
                    break;
                case 'qr_code':
                    if (typeof qrCodeManager !== 'undefined') qrCodeManager.init();
                    startSubscriptionCheck();
                    break;
                case 'more':
                    if (typeof moreManager !== 'undefined') {{
                        moreManager.init();
                    }}
                    startSubscriptionCheck();
                    break;
                case 'login':
                    if (typeof loginManager !== 'undefined') {{
                        loginManager.initialized = false;
                        loginManager.init();
                    }}
                    break;{viewer_init_cases}
            }}
        }} catch(e) {{
            console.warn('[SPA Router] Błąd inicjalizacji managera:', pageName, e);
        }}
    }}

    // --- Override navigateTo z script.js ---
    var _spaNavigateTo = function(url) {{
        try {{
            var parsed = new URL(url, window.location.origin);
            if (parsed.searchParams.has('tabOpen') || parsed.searchParams.has('ts')) {{
                window.location.href = url;
                return;
            }}
            var resolved = resolvePageName(parsed.pathname) || resolvePageName(url);
            if (resolved) {{ showPage(resolved); return; }}
        }} catch(e) {{
            var resolved2 = resolvePageName(url);
            if (resolved2) {{ showPage(resolved2); return; }}
        }}
        window.location.href = url;
    }};

    Object.defineProperty(window, '_navigateTo', {{
        configurable: true,
        enumerable: true,
        get: function() {{ return _spaNavigateTo; }},
        set: function() {{ /* ignoruj */ }}
    }});

    window._spaShowPage = showPage;

    // --- Przechwytywanie kliknięć ---
    document.addEventListener('click', function(e) {{
        var spaNav = e.target.closest('[data-spa-nav]');
        if (spaNav) {{
            e.preventDefault();
            e.stopPropagation();
            showPage(spaNav.getAttribute('data-spa-nav'));
            return;
        }}

        var routeEl = e.target.closest('[data-route]');
        if (routeEl) {{
            var route = routeEl.getAttribute('data-route');
            var resolved = resolvePageName(route);
            if (resolved) {{
                e.preventDefault();
                e.stopPropagation();
                showPage(resolved);
                return;
            }}
        }}

        var redirectEl = e.target.closest('[data-redirect]');
        if (redirectEl) {{
            var redir = redirectEl.getAttribute('data-redirect');
            var resolved2 = resolvePageName(redir);
            if (resolved2) {{
                e.preventDefault();
                e.stopPropagation();
                showPage(resolved2);
                return;
            }}
        }}

        var aTag = e.target.closest('a[href]');
        if (aTag) {{
            var href = aTag.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {{
                var resolved3 = resolvePageName(href);
                if (resolved3) {{
                    e.preventDefault();
                    e.stopPropagation();
                    showPage(resolved3);
                    return;
                }}
            }}
        }}
    }}, true);

    // --- History back/forward ---
    window.addEventListener('popstate', function(e) {{
        if (e.state && e.state.page) {{
            showPage(e.state.page, false);
        }} else {{
            var hash = location.hash.replace('#', '');
            if (hash && resolvePageName(hash)) {{
                showPage(hash, false);
            }}
        }}
    }});

    // --- Inicjalizacja ---
    function spaInit() {{
        // Zawsze zaczynaj od logowania — jak w prawdziwej aplikacji
        showPage('login');
    }}

    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', spaInit);
    }} else {{
        spaInit();
    }}

    window._spaOnSubscriptionFail = function() {{
        showPage('login');
    }};

    // Navigation API intercept (Chrome/Edge 102+)
    if (window.navigation) {{
        window.navigation.addEventListener('navigate', function(e) {{
            if (e.hashChange || e.downloadRequest) return;
            try {{
                var dest = new URL(e.destination.url);
                if (dest.searchParams.has('tabOpen') || dest.searchParams.has('ts')) return;
                var resolved = resolvePageName(dest.pathname);
                if (resolved) {{
                    e.intercept({{
                        handler: function() {{ showPage(resolved); }}
                    }});
                }}
            }} catch(err) {{}}
        }});
    }}

    window._spaRouter = {{
        showPage: showPage,
        getCurrentPage: function() {{ return _currentPage; }},
        resolvePageName: resolvePageName,
    }};

}})();
"""


# ============================================================================
# SEKCJA E2 — Patche JS dla trybu SPA
# ============================================================================

def generate_js_patches(is_per_user=False):
    """Generuje kod JS patchujący oryginalne skrypty pod SPA."""
    # W trybie per-user, document cards otwierają viewer inline zamiast redirect
    if is_per_user:
        doc_card_handler = r"""
        // Rebind document cards — w trybie per-user otwórz viewer inline
        $('[data-document-card][data-redirect]').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            var $el = $(this);
            var redirect = String($el.data('redirect') || '');
            if ($el.data('busy')) return;
            $el.data('busy', true);

            // Animacja podnoszenia
            var lift = parseInt($el.attr('data-lift'), 10) || 20;
            $el.css('transition', 'top 300ms ease');
            setTimeout(function() {
                var cls = $el.attr('class') || '';
                var m = cls.match(/top\[(\d+)px\]/);
                if (m) {
                    var cur = parseInt(m[1], 10);
                    var next = Math.max(0, cur - lift);
                    $el.attr('class', cls.replace(/top\[\d+px\]/, 'top[' + next + 'px]'));
                } else {
                    var curTop = parseInt($el.css('top')) || 0;
                    $el.css('top', (curTop - lift) + 'px');
                }
            }, 60);
            setTimeout(function() {
                // Sprawdź czy viewer istnieje w SPA
                var viewerPage = window._spaRouter.resolvePageName(redirect);
                if (viewerPage) {
                    window._spaRouter.showPage(viewerPage);
                } else {
                    // Fallback — redirect na serwer
                    window.location.href = '/' + redirect.replace(/^\/+/, '');
                }
                $el.data('busy', false);
            }, 200);
        });
"""
    else:
        doc_card_handler = r"""
        // Rebind document cards — animacja podnoszenia + redirect do serwera
        $('[data-document-card][data-redirect]').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            var $el = $(this);
            var target = '/' + String($el.data('redirect') || '').replace(/^\/+/, '');
            if ($el.data('busy')) return;
            $el.data('busy', true);
            var lift = parseInt($el.attr('data-lift'), 10) || 20;
            $el.css('transition', 'top 300ms ease');
            setTimeout(function() {
                var cls = $el.attr('class') || '';
                var m = cls.match(/top\[(\d+)px\]/);
                if (m) {
                    var cur = parseInt(m[1], 10);
                    var next = Math.max(0, cur - lift);
                    $el.attr('class', cls.replace(/top\[\d+px\]/, 'top[' + next + 'px]'));
                } else {
                    var curTop = parseInt($el.css('top')) || 0;
                    $el.css('top', (curTop - lift) + 'px');
                }
            }, 60);
            setTimeout(function() {
                window.location.href = target;
            }, 200);
        });
"""

    return f"""
// ============================================================================
// ALL-IN-ONE JS PATCHES — adaptacja istniejących skryptów pod SPA
// ============================================================================
(function() {{
    'use strict';

    $(function() {{
        $('[data-route]').off('click');
        $('[data-redirect]').not('[data-document-card]').off('click');

{doc_card_handler}

        // Rebind logout
        $('[data-button="logout"]').off('click').on('click', async function() {{
            try {{
                var response = await requests.post('/api/authorization/logout');
                if (response.success) {{
                    window._spaRouter.showPage('login');
                }}
            }} catch(e) {{
                window._spaRouter.showPage('login');
            }}
        }});

        console.log('[SPA Patches] jQuery handlery przechwycone');
    }});

    // Patch 3: Subscription check intercept
    var _origAjax = $.ajax;
    $.ajax = function(opts) {{
        if (typeof opts === 'object' && opts.url) {{
            var url = opts.url;
            if (url.indexOf('/api/data/get/subscription') !== -1) {{
                var origError = opts.error;
                var origSuccess = opts.success;
                opts.success = function(resp) {{
                    if (resp && !resp.success) {{
                        if (window._spaRouter) {{ window._spaRouter.showPage('login'); return; }}
                    }}
                    if (origSuccess) origSuccess.apply(this, arguments);
                }};
                opts.error = function(xhr) {{
                    if (xhr.status === 401 || xhr.status === 403) {{
                        if (window._spaRouter) {{ window._spaRouter.showPage('login'); return; }}
                    }}
                    if (origError) origError.apply(this, arguments);
                }};
            }}
            if (url.indexOf('/api/authorization/logout') !== -1) {{
                var origSuccess2 = opts.success;
                opts.success = function(data) {{
                    if (window._spaRouter) {{ window._spaRouter.showPage('login'); return; }}
                    if (origSuccess2) origSuccess2.apply(this, arguments);
                }};
            }}
        }}
        return _origAjax.apply($, arguments);
    }};

    // Patch 4: Body transitions
    document.addEventListener('DOMContentLoaded', function() {{
        document.body.classList.add('pt-in');
        document.body.style.opacity = '1';
        document.body.style.transform = 'none';
    }});

    // Patch 5: Swipe-back → SPA history
    var _origHistoryBack = history.back.bind(history);
    history.back = function() {{
        if (window._spaRouter) {{
            var page = window._spaRouter.getCurrentPage();
            // Jeśli jesteśmy w viewer — wróć do documents
            if (page && page.indexOf('_viewer') !== -1) {{
                window._spaRouter.showPage('documents');
                return;
            }}
            if (page && page !== 'documents' && page !== 'login') {{
                window._spaRouter.showPage('documents');
                return;
            }}
        }}
        _origHistoryBack();
    }};

    // Patch 6: Scope jQuery selectors
    var _origJQ = $.fn.init;
    var _scopedSelectors = ['[data-standalone]', '[data-wrapper]', '[data-group="navigation"]'];
    $.fn.init = function(selector, context, root) {{
        if (typeof selector === 'string' && !context && window._spaActiveSection) {{
            for (var i = 0; i < _scopedSelectors.length; i++) {{
                if (selector === _scopedSelectors[i]) {{
                    return _origJQ.call(this, selector, window._spaActiveSection, root);
                }}
            }}
        }}
        return _origJQ.call(this, selector, context, root);
    }};
    $.fn.init.prototype = $.fn;

}})();
"""


# ============================================================================
# SEKCJA F — Assembler końcowy
# ============================================================================

class Compiler:
    def __init__(self, output_path=None, verbose=False,
                 user_data_dir=None, selected_docs=None):
        self.output_path = Path(output_path) if output_path else DEFAULT_OUTPUT
        global VERBOSE
        VERBOSE = verbose
        self.css_resolver = CSSResolver()
        self.js_resolver = JSResolver()
        self.page_parser = PageParser(self.css_resolver, self.js_resolver)

        # Tryb per-user: jeśli podano folder użytkownika i wybrane dokumenty
        self.user_data_dir = Path(user_data_dir) if user_data_dir else None
        self.selected_docs = selected_docs or []
        self.is_per_user = bool(self.user_data_dir and self.selected_docs)

    def compile(self):
        """Główna metoda kompilacji — generuje all-in-one HTML."""
        log("=" * 60)
        log("All-in-One HTML Compiler — START")
        if self.is_per_user:
            log(f"Tryb per-user: {self.user_data_dir}")
            log(f"Wybrane dokumenty: {', '.join(self.selected_docs)}")
        log("=" * 60)

        # Krok 1: Parsuj wszystkie strony HTML
        page_sections = []
        for page_name, html_file in PAGES.items():
            section_html = self.page_parser.parse_page(html_file, page_name)
            if section_html:
                page_sections.append(section_html)

        # Krok 1b: Parsuj dokumenty użytkownika (tryb per-user)
        user_doc_sections = []
        embedded_data_js = ""
        data_override_js = ""
        user_photo_b64 = ""
        if self.is_per_user:
            log("Parsowanie dokumentów użytkownika...")
            user_doc_sections = self._parse_user_documents()
            log(f"  Sekcje dokumentów: {len(user_doc_sections)}")

            log("Generowanie osadzonych danych...")
            embedded_data_js = self._generate_embedded_data()

            log("Generowanie override API danych...")
            data_override_js = self._generate_data_override()

            # Osadzenie zdjęcia
            user_photo_b64 = self._find_user_photo()
            if user_photo_b64:
                log("Zdjęcie użytkownika osadzone jako Base64", "OK")

        # Krok 2: Zbierz i rozwiąż CSS
        log("Resolving CSS...")
        css_content = self._resolve_all_css()

        # Krok 3: Zbierz i rozwiąż JS
        log("Resolving JS...")
        js_blocks = self._resolve_all_js()

        # Krok 4: Generuj SPA router & patche
        log("Generowanie SPA routera...")
        spa_router = generate_spa_router(
            selected_docs=self.selected_docs if self.is_per_user else [],
            is_per_user=self.is_per_user,
        )
        js_patches = generate_js_patches(
            is_per_user=self.is_per_user,
        )

        # Krok 5: Złóż wynikowy HTML
        log("Składanie wynikowego HTML...")
        final_html = self._assemble(
            page_sections, css_content, js_blocks,
            spa_router, js_patches,
            user_doc_sections=user_doc_sections,
            embedded_data_js=embedded_data_js,
            data_override_js=data_override_js,
            user_photo_b64=user_photo_b64,
        )

        # Krok 6: Zapisz
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_path, "w", encoding="utf-8") as f:
            f.write(final_html)

        # Podsumowanie
        size_mb = os.path.getsize(self.output_path) / (1024 * 1024)
        log("=" * 60)
        log(f"GOTOWE! Plik: {self.output_path}", "OK")
        log(f"Rozmiar: {size_mb:.2f} MB", "OK")
        log(f"Strony zmergowane: {self.page_parser.stats['pages']}", "OK")
        if self.is_per_user:
            log(f"Dokumenty użytkownika: {len(user_doc_sections)}", "OK")
        log(f"Obrazy zinlineowane (HTML): {self.page_parser.stats['images_inlined']}", "OK")
        log(f"Pliki CSS: {self.css_resolver.stats['files']}", "OK")
        log(f"Importy CSS rozwiązane: {self.css_resolver.stats['imports_resolved']}", "OK")
        log(f"URL-e CSS zinlineowane: {self.css_resolver.stats['urls_inlined']}", "OK")
        log(f"Pliki JS: {self.js_resolver.stats['files']}", "OK")
        log(f"Assety JS zinlineowane: {self.js_resolver.stats['assets_inlined']}", "OK")
        log("=" * 60)

        return str(self.output_path)

    # ------------------------------------------------------------------
    # Metody per-user: dokumenty użytkownika, embedded data, override API
    # ------------------------------------------------------------------

    def _parse_user_documents(self):
        """Parsuje wygenerowane dokumenty użytkownika i zwraca sekcje HTML."""
        sections = []
        for doc_key in self.selected_docs:
            filename = USER_DOC_MAP.get(doc_key)
            if not filename:
                log(f"Nieznany typ dokumentu: {doc_key}", "WARN")
                continue

            doc_path = self.user_data_dir / filename
            if not doc_path.exists():
                log(f"Dokument nie istnieje: {doc_path}", "WARN")
                continue

            log(f"  Parsowanie dokumentu: {doc_key} ({filename})")
            soup = BeautifulSoup(read_text(doc_path), "html.parser")

            body = soup.find("body")
            if not body:
                log(f"  Brak <body> w {filename}", "WARN")
                continue

            # Inline'uj obrazy — mapuj src na Base64
            for img in body.find_all("img"):
                src = img.get("src", "")
                if not src or src.startswith("data:"):
                    continue

                # Zdjęcie użytkownika: /user_files/username/zdjecie_*.jpg
                if "zdjecie_" in src:
                    photo_b64 = self._find_user_photo()
                    if photo_b64:
                        img["src"] = photo_b64
                    continue

                # Zasoby z /assets/
                if src.startswith("/assets/") or src.startswith("assets/"):
                    resolved = resolve_path(STATIC_NEW, src)
                    if resolved and resolved.exists():
                        img["src"] = file_to_base64(resolved)
                elif not src.startswith("http"):
                    resolved = resolve_path(self.user_data_dir, src)
                    if resolved and resolved.exists():
                        img["src"] = file_to_base64(resolved)

            # Inline'uj url() w style atrybutach
            for tag in body.find_all(style=True):
                style = tag["style"]
                if "url(" in style:
                    tag["style"] = self._replace_doc_style_urls(style)

            # Patchuj nawigację: data-redirect="documents" → data-spa-nav
            nav_targets = {
                "documents": "documents",
                "/documents": "documents",
                "/services": "services",
                "/qr_code": "qr_code",
                "/more": "more",
            }
            for a_tag in body.find_all("a", href=True):
                href = a_tag["href"].split("?")[0]
                if href in nav_targets:
                    a_tag["data-spa-nav"] = nav_targets[href]
                    a_tag["href"] = f"#{nav_targets[href]}"
            for el in body.find_all(attrs={"data-redirect": True}):
                redir = el["data-redirect"]
                if redir in nav_targets:
                    el["data-spa-nav"] = nav_targets[redir]

            # Inline CSS i JS z nagłówka dokumentu
            head = soup.find("head")
            if head:
                # Inline <style> tagów z head
                for style_tag in head.find_all("style"):
                    body.insert(0, soup.new_tag("style"))
                    body.find_all("style")[-1].string = style_tag.string or ""

                # JS z <script src> w nagłówku — inline'uj (z deduplikacją)
                for script_tag in head.find_all("script", src=True):
                    src = script_tag["src"]
                    resolved = resolve_path(STATIC_NEW, src)
                    if resolved and resolved.exists():
                        resolved = Path(resolved).resolve()
                        if resolved in self.js_resolver._visited:
                            log_verbose(f"  JS pominięty (duplikat): {resolved.name}")
                            continue
                        self.js_resolver._visited.add(resolved)
                        content = read_text(resolved)
                        content = self.js_resolver._inline_asset_urls(content)
                        new_script = soup.new_tag("script")
                        new_script.string = content
                        body.append(new_script)

            viewer_name = f"{doc_key}_viewer"
            inner = body.decode_contents()
            section = (
                f'<div data-page="{viewer_name}" class="page-section" '
                f'style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;">\n'
                f'{inner}\n</div>\n'
            )
            sections.append(section)

        return sections

    def _replace_doc_style_urls(self, style_str):
        """Zamienia url() w style atrybutach dokumentu użytkownika."""
        def replace_url(match):
            url = match.group(1).strip("'\"")
            if url.startswith("data:") or url.startswith("http"):
                return match.group(0)
            # Spróbuj /assets/ najpierw
            resolved = resolve_path(STATIC_NEW, url)
            if resolved and resolved.exists():
                return f"url('{file_to_base64(resolved)}')"
            # Spróbuj relatywnie do user_data_dir
            resolved2 = resolve_path(self.user_data_dir, url)
            if resolved2 and resolved2.exists():
                return f"url('{file_to_base64(resolved2)}')"
            return match.group(0)
        return re.sub(r"url\(([^)]+)\)", replace_url, style_str)

    def _find_user_photo(self):
        """Szuka zdjęcia użytkownika w folderze i zwraca Base64 data URI."""
        if not self.user_data_dir:
            return ""
        import glob
        pattern = str(self.user_data_dir / "zdjecie_*.*")
        matches = glob.glob(pattern)
        if matches:
            return file_to_base64(matches[0])
        return ""

    def _generate_embedded_data(self):
        """Generuje JS z osadzonymi danymi użytkownika z last_form_data.json."""
        if not self.user_data_dir:
            return ""

        # Szukaj last_form_data.json w logs/ (rodzeństwo files/)
        logs_dir = self.user_data_dir.parent / "logs"
        form_data_path = logs_dir / "last_form_data.json"
        if not form_data_path.exists():
            # Może jest w user_data_dir bezpośrednio?
            form_data_path = self.user_data_dir / "last_form_data.json"
        if not form_data_path.exists():
            log("Brak last_form_data.json — embedded data będą puste", "WARN")
            return ""

        try:
            with open(form_data_path, "r", encoding="utf-8") as f:
                form_data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            log(f"Błąd czytania last_form_data.json: {e}", "WARN")
            return ""

        from datetime import datetime
        now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")

        # Transformuj polskie pola na format API
        api_data = {}
        for doc_key, sections in FORM_FIELD_MAP.items():
            doc_data = {}
            for section_name, field_map in sections.items():
                section_data = {}
                for api_field, form_field in field_map.items():
                    section_data[api_field] = str(form_data.get(form_field, "")).upper()
                # Dodaj last_update do sekcji "personal" lub "other"
                if section_name in ("personal", "other"):
                    section_data["last_update"] = now_str
                doc_data[section_name] = section_data
            api_data[doc_key] = doc_data

        # Mapa dostępnych dokumentów
        available_docs = {}
        for doc_key in USER_DOC_MAP:
            available_docs[doc_key] = 1 if doc_key in self.selected_docs else 0

        # Zdjęcie Base64
        photo_b64 = self._find_user_photo()

        js_lines = []
        js_lines.append("// === EMBEDDED USER DATA ===")
        js_lines.append(f"window.__EMBEDDED_USER_DATA = {json.dumps(api_data, ensure_ascii=False)};")
        js_lines.append(f"window.__AVAILABLE_DOCS = {json.dumps(available_docs)};")
        js_lines.append(f"window.__SELECTED_DOCS = {json.dumps(self.selected_docs)};")
        if photo_b64:
            js_lines.append(f'window.__USER_PHOTO_BASE64 = "{photo_b64}";')
        else:
            js_lines.append('window.__USER_PHOTO_BASE64 = "";')
        js_lines.append(f"window.__IS_PER_USER = true;")

        return "\n".join(js_lines)

    def _generate_data_override(self):
        """Generuje JS patchujący $.ajax dla /api/data/get/details i /api/user-documents."""
        return r"""
// === DATA OVERRIDE — embedded data zamiast API ===
(function() {
    'use strict';
    if (!window.__IS_PER_USER) return;

    var _origAjaxForData = $.ajax;
    $.ajax = function(opts) {
        if (typeof opts === 'object' && opts.url) {
            var url = opts.url;

            // Override /api/data/get/details → embedded data
            if (url.indexOf('/api/data/get/details') !== -1) {
                if (opts.success) {
                    setTimeout(function() {
                        opts.success({
                            success: true,
                            message: "Data from embedded source",
                            data: window.__EMBEDDED_USER_DATA
                        });
                    }, 10);
                }
                // Zwróć fake jqXHR
                return $.Deferred().resolve({
                    success: true,
                    data: window.__EMBEDDED_USER_DATA
                }).promise();
            }

            // Override /api/user-documents → embedded doc availability
            if (url.indexOf('/api/user-documents') !== -1) {
                var docData = {
                    success: true,
                    data: { documents: window.__AVAILABLE_DOCS || {} }
                };
                if (opts.success) {
                    setTimeout(function() { opts.success(docData); }, 10);
                }
                return $.Deferred().resolve(docData).promise();
            }

            // Override /api/document-hashes → empty (nie potrzeba cache invalidation)
            if (url.indexOf('/api/document-hashes') !== -1) {
                var hashData = { success: true, hashes: {} };
                if (opts.success) {
                    setTimeout(function() { opts.success(hashData); }, 10);
                }
                return $.Deferred().resolve(hashData).promise();
            }
        }
        return _origAjaxForData.apply($, arguments);
    };

    // Override requests.get() która jest używana w document managers
    if (window.requests) {
        var _origRequestsGet = window.requests.get;
        window.requests.get = function(url, params) {
            if (url.indexOf('/api/data/get/details') !== -1) {
                return Promise.resolve({
                    success: true,
                    data: window.__EMBEDDED_USER_DATA
                });
            }
            if (url.indexOf('/api/user-documents') !== -1) {
                return Promise.resolve({
                    success: true,
                    data: { documents: window.__AVAILABLE_DOCS || {} }
                });
            }
            return _origRequestsGet.apply(window.requests, arguments);
        };
    }

    // Podmień src zdjęć user_photo na embedded Base64
    if (window.__USER_PHOTO_BASE64) {
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('img#user_photo, img[data-placeholder*="picture"]').forEach(function(img) {
                if (window.__USER_PHOTO_BASE64) {
                    img.src = window.__USER_PHOTO_BASE64;
                }
            });
        });

        // Interceptuj $.fn.attr('src', FACE_PATH) — managery dokumentów
        // ustawiają zdjęcie na hardcoded /assets/img/photos/*_face.jpg
        // W per-user mode podmieniamy na embedded Base64
        var _origAttr = $.fn.attr;
        $.fn.attr = function(name, value) {
            if (arguments.length === 2 && name === 'src' && typeof value === 'string' &&
                value.indexOf('/assets/img/photos/') !== -1 && value.indexOf('_face') !== -1) {
                if (window.__USER_PHOTO_BASE64) {
                    return _origAttr.call(this, name, window.__USER_PHOTO_BASE64);
                }
            }
            return _origAttr.apply(this, arguments);
        };
    }

    // ---------------------------------------------------------------
    // updateDocumentCards — reimplementacja z script.js
    // script.js uruchamia tę logikę tylko gdy path==='documents',
    // a w all-in-one path to 'allinone.html' — więc musimy ją dodać.
    // ---------------------------------------------------------------
    var DOC_KEYS = ['mdowod', 'mprawojazdy', 'school_id', 'student_id'];

    function getDocLayoutMode() {
        var s = localStorage.getItem('documents_layout_mode');
        return ['overlap','grid','list'].indexOf(s) !== -1 ? s : 'overlap';
    }

    function allInOneUpdateCards(apiData) {
        var data = apiData || {};
        var saved = {};
        try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
        var activeLayout = getDocLayoutMode();
        var visibleIndex = 0;
        var offset = 70;

        $('[data-layout-view]').addClass('display-none');
        $('[data-layout-view="' + activeLayout + '"]').removeClass('display-none');

        DOC_KEYS.forEach(function(key) {
            var hasFile = Number(data[key]) === 1;
            var enabled = hasFile && (saved[key] !== undefined ? Number(saved[key]) === 1 : true);
            var $overlapCard = $('[data-layout-card="overlap"][data-document-key="' + key + '"]');
            var $gridCard = $('[data-layout-card="grid"][data-document-key="' + key + '"]');
            var $listCard = $('[data-layout-card="list"][data-document-key="' + key + '"]');
            var $separator = $('[data-document-separator="' + key + '"]');
            var $addButton = $('[data-document-add="' + key + '"]');
            $overlapCard.removeClass(function(i, cn) {
                return (cn.match(/top\[\d+px\]/g) || []).join(' ');
            });
            if (enabled) {
                $overlapCard.removeClass('display-none').addClass('top[' + (visibleIndex * offset) + 'px]');
                $gridCard.removeClass('display-none');
                $listCard.removeClass('display-none');
                $separator.addClass('display-none');
                $addButton.addClass('display-none');
                visibleIndex++;
            } else {
                $overlapCard.addClass('display-none');
                $gridCard.addClass('display-none');
                $listCard.addClass('display-none');
                $separator.removeClass('display-none');
                $addButton.removeClass('display-none');
            }
        });

        var $visList = $('[data-layout-card="list"]').not('.display-none');
        $visList.removeClass('document-list-row-last-visible document-list-row-divider-strong');
        $visList.last().addClass('document-list-row-last-visible');
        $visList.each(function(idx) {
            if (idx === 0 || idx === ($visList.length - 2)) $(this).addClass('document-list-row-divider-strong');
        });

        var oh = visibleIndex > 0 ? (235 + ((visibleIndex - 1) * offset)) : 0;
        $('[data-layout-view="overlap"]').css('min-height', oh ? oh + 'px' : '0');
        $('[data-documents-layout-root]').attr('data-documents-ready', '1');
    }

    // Expose globally — SPA router startDocumentPolling() calls this
    window._lastDocData = window.__AVAILABLE_DOCS || {};
    window._docAvailability = window.__AVAILABLE_DOCS || {};
    window._updateDocumentCards = function() {
        allInOneUpdateCards(window._lastDocData || {});
    };

    // Initialize cards once DOM is ready
    $(function() {
        allInOneUpdateCards(window.__AVAILABLE_DOCS || {});
    });

    console.log('[All-in-One] Data override aktywny — embedded data');
})();
"""

    def _resolve_all_css(self):
        """Zbiera wszystkie CSS z wszystkich stron i rozwiązuje w jeden blok."""
        all_css = []

        for ref in self.page_parser.css_refs:
            filepath = resolve_path(STATIC_NEW, ref)
            if filepath and filepath.exists():
                resolved = self.css_resolver.resolve(filepath)
                if resolved:
                    all_css.append(f"/* === {Path(ref).name} === */\n{resolved}")

        return "\n\n".join(all_css)

    def _resolve_all_js(self):
        """Zbiera wszystkie JS z wszystkich stron i rozwiązuje."""
        # Skrypty ze stron HTML
        all_refs = list(self.page_parser.js_refs)
        # Dodaj extra skrypty które nie są w <script src> ale są potrzebne
        for extra in EXTRA_SCRIPTS:
            if extra not in all_refs:
                all_refs.append(extra)
        return self.js_resolver.resolve_scripts(all_refs)

    def _assemble(self, page_sections, css_content, js_blocks, spa_router, js_patches,
                   user_doc_sections=None, embedded_data_js="", data_override_js="",
                   user_photo_b64=""):
        """Składa finalny HTML."""
        pages_html = "\n".join(page_sections)

        # Dodaj sekcje dokumentów użytkownika
        if user_doc_sections:
            pages_html += "\n" + "\n".join(user_doc_sections)

        js_all = "\n\n".join(
            [f"// === {name} ===\n{code}" for name, code in js_blocks]
        )

        # Zewnętrzne CSS (Google Fonts itp.)
        external_links = ""
        if self.page_parser.external_css:
            external_links += '    <link rel="preconnect" href="https://fonts.googleapis.com">\n'
            external_links += '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            for href in self.page_parser.external_css:
                external_links += f'    <link href="{href}" rel="stylesheet">\n'

        return f"""<!DOCTYPE html>
<html lang="pl" data-theme="default" data-mode="light" data-custom>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="description" content="">
    <meta name="author" content="mObywatel">
    <meta name="theme-color" content="#f5f6fb">
    <meta name="apple-mobile-web-app-title" content="mObywatel">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta property="og:title" content="mObywatel">
    <meta property="og:type" content="website">
    <title>mObywatel - All in One</title>
    <link rel="manifest" href="/static/manifest.json">
{external_links}    <style>
{css_content}

/* === All-in-One SPA overrides === */
.page-section {{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}}
.page-section[style*="display: none"],
.page-section[style*="display:none"] {{
    pointer-events: none;
}}
body {{
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    margin: 0;
    padding: 0;
    opacity: 1 !important;
    transform: none !important;
}}
a[data-spa-nav].nav-active span.active {{
    color: rgba(var(--blue-active), 1);
    font-weight: 600;
}}
    </style>
</head>
<body>
{pages_html}
<script>
// === Embedded user data (musi być PRZED skryptami stron) ===
{embedded_data_js}
</script>
<script>
{js_all}

{spa_router}

{js_patches}

// === Data override (musi być PO skryptach stron i routerze) ===
{data_override_js}
</script>
</body>
</html>"""


# ============================================================================
# SEKCJA G — CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="All-in-One HTML Compiler dla mObywatel PWA"
    )
    parser.add_argument(
        "--output", "-o",
        default=str(DEFAULT_OUTPUT),
        help=f"Ścieżka pliku wyjściowego (domyślnie: {DEFAULT_OUTPUT})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Wyświetl szczegółowe logi"
    )
    parser.add_argument(
        "--user-data-dir",
        default=None,
        help="Ścieżka do katalogu user_data/<username>/files/ (tryb per-user)"
    )
    parser.add_argument(
        "--selected-docs",
        default=None,
        help="Lista dokumentów do osadzenia, rozdzielona przecinkami (np. mdowod,mprawojazdy)"
    )
    args = parser.parse_args()

    selected = None
    if args.selected_docs:
        selected = [d.strip() for d in args.selected_docs.split(",") if d.strip()]

    compiler = Compiler(
        output_path=args.output,
        verbose=args.verbose,
        user_data_dir=args.user_data_dir,
        selected_docs=selected,
    )
    try:
        result_path = compiler.compile()
        if result_path:
            log(f"Plik wyjściowy: {result_path}", "OK")
    except Exception as e:
        log(f"BŁĄD KOMPILACJI: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
