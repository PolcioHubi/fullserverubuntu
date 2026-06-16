# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Mobywatel-Creator** is a Flask web app that generates mock Polish "mObywatel" government-app
documents (mDowód / national ID, prawo jazdy / driving licence, legitymacja szkolna & studencka,
forklift permit) from user-submitted form data. Users register (gated by single-use access keys),
fill a form, and the server produces per-user self-contained HTML documents. It also has an admin
panel and social features (global chat, notifications, announcements, a "Hubert Coins" point
economy). The codebase, comments, and most docs are in **Polish**.

## Commands

```bash
# --- Dev ---
python app.py                       # dev server, debug=True, 0.0.0.0:5000 (the __main__ block)
flask --app app run                 # alt launch; `app` is a module-level singleton in app.py
flask --app app init-db             # drop+recreate all tables and seed the admin user (see below)

# --- Tests (pytest; coverage is ALWAYS on via pytest.ini addopts) ---
pytest                              # whole suite; run from PROJECT ROOT (tests use relative paths)
pytest --no-cov                     # faster local iteration (skip coverage)
pytest tests/test_services.py                                   # single file
pytest tests/test_pesel_generator.py::test_generate_pesel_male  # single test (function)
pytest tests/test_new_documents.py::TestAssetServing::test_css_style_served  # test in a class
pytest -k "pesel and not extended"  # keyword expression
playwright install                  # ONE-TIME: download browsers before any *_e2e.py test
# Skip all Playwright E2E (no marker exists — must ignore by path):
pytest --ignore=tests/test_e2e.py --ignore=tests/test_e2e_extended.py \
  --ignore=tests/test_admin_panel_full_e2e.py --ignore=tests/test_admin_access_e2e.py \
  --ignore=tests/test_app_post_e2e.py --ignore=tests/test_registration_validation_e2e.py \
  --ignore=tests/test_impersonation.py

# --- Lint / format (ruff, NOT black/flake8 — GEMINI.md is wrong about this) ---
pre-commit install                  # ruff + ruff-format + pytest + no-live-server-injection hooks
pre-commit run --all-files

# --- Dependencies (pip-tools; edit the .in files, never hand-edit the .txt) ---
pip install -r requirements.txt          # prod runtime
pip install -r requirements-dev.txt      # + test/lint toolchain
pip-compile requirements.in              # regenerate requirements.txt
pip-compile --output-file=requirements-dev.txt requirements-dev.in

# --- Docker (app only — see gotcha: no redis/nginx service) ---
docker compose up --build           # gunicorn on :5000; runs `flask db upgrade` first

# --- Production (bare-metal Ubuntu) ---
sudo ./deploy_ubuntu.sh             # provisions user/venv/systemd/nginx/redis/certbot (destructive)
sudo systemctl restart mobywatel    # restart the prod Gunicorn service
```

## Architecture

Strict layered design, but note the **controller is a single monolith**:

```
app.py (~5575 lines, module-global `app`, NO app factory, NO Blueprints, ~85 @app.route)
  └─ services.py    : AccessKeyService, AnnouncementService, StatisticsService,
  │                   NotificationService, ChatService  (all DB CRUD via SQLAlchemy)
  └─ user_auth.py   : UserAuthManager (auth/registration/tokens/coins) + AuthUser(User, UserMixin)
       └─ models.py : `db = SQLAlchemy()` + 6 models (User, AccessKey, Notification,
                       Announcement, ChatMessage, File). User.username is the PRIMARY KEY.
  pesel_generator.py: leaf utility, no DB/Flask deps (generates valid Polish PESEL numbers)
```

Routes are thin HTTP/validation/logging glue; all persistence is delegated to the service classes,
instantiated once as module globals near `app.py:997`. `wsgi.py` exposes the app as
`application` (production uses `gunicorn wsgi:application`).

**Extensions all initialize at import time on the global `app`** (so `import app` has heavy side
effects — it opens Redis sessions, Swagger, CSRF, Limiter, cache, `db.init_app`): Flask-Session
(Redis), flask-wtf CSRFProtect, flasgger Swagger, Flask-SQLAlchemy, Flask-Migrate, Flask-Caching
(Redis), Flask-Login, Flask-Limiter. In `TESTING`/`load_test` mode the limiter becomes a no-op
`DummyLimiter` so the `@limiter.limit` decorators still import.

**Redis is effectively required** and used in 3+ roles, each with its own URL/default:
sessions (`SESSION_REDIS_URL`, default `redis://127.0.0.1:6379`), cache (`CACHE_REDIS_URL`, default
`redis://localhost:6379/0`), rate-limit storage (`RATELIMIT_STORAGE_URL`, prod default
`redis://redis:6379`, dev `memory://`). Because Gunicorn **forks workers**, `app.py` defines
`_CrossProcessLock` / `_CrossProcessFlag` (Redis-backed, with `threading` fallback) to coordinate
single-flight admin import/restart operations across workers.

**Request lifecycle hooks** (in `app.py`): `before_request` assigns `g.request_id` + `g.csp_nonce`,
rotates `logs/` when it exceeds 5MB, blocks requests during an import-swap, and force-logs-out
deactivated users; `after_request` injects a cache-busting version guard into HTML and sets a
**per-path Content-Security-Policy with a per-request nonce** (CSP is emitted by Flask, NOT Nginx,
to avoid duplicate headers).

### Document-generation pipeline

The core feature lives mostly in the `/` route (GET/POST) plus imported transformers:

1. POST picks an output filename + base template by `template_version`
   (`new_mdowod`, `new_mprawojazdy`, `new_wozek`, `new_school_id`, `new_student_id`, else legacy).
2. Loads a **clean base template from `document_templates/*.txt`** (HTML stored as `.txt`!) into
   BeautifulSoup, builds `new_data` from the form, and calls the matching transformer:
   `replace_html_data` (legacy, defined in `app.py`) or `replace_html_data_new` / `_mprawojazdy` /
   `_wozek` / `_school_id` / `_student_id` (imported from the `replace_new*.py` modules — these are
   **imported functions, not standalone scripts**). All values pass through `bleach` sanitization.
3. Writes to `user_data/<username>/files/<doc>_new.html` only if the content/photo hash changed
   (**dedup-on-write** via SHA-256), caches the submission to `user_data/<username>/logs/
   last_form_data.json`, and writes a PII-redacted audit line to `form_submissions.log`.
4. `compile_allinone.py` is an **optional** separate step (route `/api/compile-allinone`, also a
   standalone CLI) that bundles the `static/new/` mObywatel SPA + a user's docs + all assets
   (CSS/JS/fonts/images Base64-inlined) into one `allinone.html`.

Two template systems coexist: **legacy** (`pasted_content.txt` → `dowodnowy.html`) and the current
**new-UI** (`document_templates/*.txt` → `*_new.html`). `templates/` (Jinja2 app UI:
login/register/admin) is unrelated to `document_templates/` (the fake-document HTML).

## Configuration & data

- Config is selected by `FLASK_ENV` (`development` default / `production`) → the `config` dict in
  `production_config.py`. **Production hard-exits at startup if `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
  or `SECRET_KEY` are missing.** `APP_ENV_MODE=load_test` disables CSRF + limiter but is rejected
  when `FLASK_ENV=production`.
- Database: **SQLite at `auth_data/database.db`**, overridable via `SQLALCHEMY_DATABASE_URI`. Tables
  auto-create on startup (`ensure_runtime_database_tables` → `db.create_all()`) if missing.
- Runtime data dirs (gitignored, created at runtime): `auth_data/` (DB), `user_data/<username>/
  {files,logs}` (generated docs + cached form data + audit logs), `logs/` (app/activity logs).
- Key env vars: `SECRET_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FLASK_ENV`, `APP_ENV_MODE`,
  `SESSION_REDIS_URL`, `CACHE_REDIS_URL`, `RATELIMIT_STORAGE_URL`, `SQLALCHEMY_DATABASE_URI`,
  `MAX_CONTENT_LENGTH`, `IMPORT_MAX_*`, `RECOVERY_TOKEN_TTL_HOURS`, `EXPOSE_RESET_TOKEN`,
  `EXPOSE_RECOVERY_TOKEN`, `LOG_LEVEL`.

## Conventions & non-obvious gotchas

- **The README.md and GEMINI.md are partly inaccurate — trust the code.** README.md (Polish)
  describes a raw-`sqlite3` data layer with `database.py`, `init_db()`, and `_managed_connection()`
  that **do not exist**; persistence is entirely Flask-SQLAlchemy via `models.py`. (The `import
  sqlite3` in `app.py` is only for low-level PRAGMA/ADD-COLUMN schema helpers, not the data layer.)
  GEMINI.md wrongly says lint is black/flake8 (it's ruff) and the WSGI target is `wsgi:app` (it's
  `wsgi:application`).
- **No `migrations/` directory is checked in.** Flask-Migrate is wired up, but Alembic scripts are
  generated on first deploy. `deploy_ubuntu.sh` now creates the repo only on first install and never
  deletes the DB on re-run (it used to `rm -rf migrations` + drop the DB every time). On a clean
  checkout, `flask db upgrade` (and the Docker `CMD`) has nothing to apply — use **`flask --app app
  init-db`**, which falls back to `db.create_all()` and seeds the admin.
- **`docker-compose.yml` now includes `redis` and `nginx` services** and points the app's Redis URLs
  at the `redis` service (it previously defined only `app`, so sessions/cache/limiter couldn't
  connect). The bare-metal `deploy_ubuntu.sh` path uses local `redis-server`; the production Nginx
  config is generated inline inside `deploy_ubuntu.sh` (Unix socket, real domain, SSL) — the root
  `nginx.conf` is the compose/dev one.
- **Passwords use bcrypt** (`BCRYPT_ROUNDS=12`) with an explicit 72-byte truncation guard, not
  werkzeug. Recovery/reset tokens are stored sha256-hashed; the raw token is shown to the user once.
- **PII redaction is load-bearing**: `_redact_form_data` / `_PII_FORM_FIELDS` keep PESEL/addresses/
  parents out of logs, and `sqlalchemy.engine`/`pool` loggers are pinned to `WARNING`. Do not lower
  these.
- The uploaded **user-photo filename is hard-coded** (`zdjecie_686510da4d2591.91511191.jpg`) and
  intentionally not randomized — generated documents reference that exact `<img src>`, so renaming
  it breaks every previously generated document. One photo per user.
- The configured admin username is treated as **not a normal user**: it is excluded from the regular
  user-management/admin APIs (returns 403).
- `.env` ships insecure placeholders (`admin`/`admin`) for local/Docker only (`.env.example` is the
  template). In production the startup guard now **rejects** default/weak admin passwords and short
  secret keys, and `DevelopmentConfig.SECRET_KEY` is a per-process random value (no hardcoded key).
- The app is wrapped in `ProxyFix` (trusts one proxy hop) so per-IP rate limiting sees the real
  client IP and `request.is_secure` (HSTS) is correct behind nginx. All security headers
  (CSP/HSTS/Referrer-Policy/Permissions-Policy/X-Frame/X-Content-Type) are emitted by Flask
  (`set_security_headers`); the nginx snippet deliberately adds none, to avoid duplicates.
- Tests: `tests/conftest.py` sets env vars (`ADMIN_USERNAME=admin_test`, `FLASK_TESTING=1` which
  disables the limiter, a temp on-disk SQLite DB) **at import time, before importing `app`** — you
  don't set these yourself. CSRF is off by default in tests (only `csrf_enabled_client` turns it
  on). `live_server` is a hand-rolled daemon thread on **port 5000** (must be free), not pytest-
  flask's. Several `test_server_deployment.py` tests are **skipped on Windows**.
- `ProductionConfig.init_app` (JSON logging) is defined but never called — effectively dead code.
