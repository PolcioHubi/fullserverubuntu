import atexit
import bleach
import click
import gc
import hashlib
import hmac
import json
import logging
import logging.config
import os
import random
import re
import shutil
import sqlite3
import stat
import string
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import zipfile
import redis
from pathlib import PurePosixPath
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import wraps
from logging.handlers import RotatingFileHandler
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError


from bs4 import BeautifulSoup
from replace_new import replace_html_data_new
from replace_new_mprawojazdy import replace_html_data_mprawojazdy
from replace_new_school_id import replace_html_data_school_id
from replace_new_student_id import replace_html_data_student_id
from dotenv import load_dotenv
from flask import (
    Flask,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)
from flask.cli import with_appcontext
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import (
    LoginManager,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf

from models import ChatMessage, User, db
from pesel_generator import generate_pesel
from production_config import config
from services import (
    AccessKeyService,
    AnnouncementService,
    ChatService,
    NotificationService,
    StatisticsService,
)
from user_auth import UserAuthManager

load_dotenv()  # Load environment variables from .env file

from flask_session import Session
from werkzeug.exceptions import RequestEntityTooLarge

# Determine operating mode for conditional security features
APP_ENV_MODE = os.environ.get("APP_ENV_MODE", "development")
is_load_test_mode = (APP_ENV_MODE == "load_test")

app = Flask(__name__, static_folder="static", static_url_path="/static")

# Configure session to use Redis
app.config["SESSION_TYPE"] = "redis"
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_USE_SIGNER"] = True
app.config["SESSION_REDIS"] = redis.from_url("redis://127.0.0.1:6379")

from flasgger import Swagger

# Create and initialize the Session
server_session = Session(app)

# Initialize Swagger
swagger = Swagger(app)

# ============== Logging Configuration ===============
log_dir = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(log_dir, exist_ok=True)

# Konfiguracja głównego loggera aplikacji (app.log)
log_file = os.path.join(log_dir, "app.log")
file_handler = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=5)
file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
    )
)
file_handler.setLevel(logging.DEBUG)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.DEBUG)

# Konfiguracja logowania SQLAlchemy
logging.getLogger("sqlalchemy.engine").setLevel(logging.DEBUG)
logging.getLogger("sqlalchemy.pool").setLevel(logging.DEBUG)

# Konfiguracja dedykowanego loggera aktywności użytkowników (user_activity.log)
activity_log_file = os.path.join(log_dir, "user_activity.log")
activity_handler = RotatingFileHandler(
    activity_log_file, maxBytes=5 * 1024 * 1024, backupCount=5
)
activity_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s - USER_ACTION - IP: %(ip)s - User: %(user)s - Action: %(action)s"
    )
)
activity_logger = logging.getLogger("user_activity")
activity_logger.addHandler(activity_handler)
activity_logger.setLevel(logging.DEBUG)

# Also configure the root logger
logging.basicConfig(level=logging.DEBUG, handlers=[file_handler])

app.logger.info("Mobywatel application starting up...")

# Load configuration based on FLASK_ENV environment variable
env = os.environ.get("FLASK_ENV", "development")
app_config = config[env]
app.config.from_object(app_config)
# Conditionally disable CSRF for load testing
if is_load_test_mode:
    app.config["WTF_CSRF_ENABLED"] = False
    app.logger.warning("CSRF protection is DISABLED due to APP_ENV_MODE=load_test")

# Password-reset token visibility is disabled by default.
app.config["EXPOSE_RESET_TOKEN"] = (
    os.environ.get("EXPOSE_RESET_TOKEN", "false").lower() in ("1", "true", "yes")
)

# Operational locks for admin-only single-flight operations.
import_operation_lock = threading.Lock()
restart_operation_lock = threading.Lock()
import_swap_quiesce_event = threading.Event()

csrf = CSRFProtect(app)
app.logger.info("CSRF protection initialized.")
app.logger.info(f"App debug mode: {app.debug}, App testing mode: {app.testing}")

# CRITICAL: Exit if in production with default credentials or missing secret key
if env == "production":
    # Check for missing critical environment variables
    if not all(
        [
            app.config.get("ADMIN_USERNAME"),
            app.config.get("ADMIN_PASSWORD"),
            app.config.get("SECRET_KEY"),
        ]
    ):
        app.logger.critical(
            "CRITICAL ERROR: Missing one or more required environment variables for production (ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY)."
        )
        sys.exit(1)

# ============== Database and Migrations Setup ===============
# Construct the database configuration, allowing tests to override the URI
default_db_file = os.path.join(os.path.dirname(__file__), "auth_data", "database.db")
configured_db_uri = os.environ.get("SQLALCHEMY_DATABASE_URI")
database_uri = configured_db_uri or f"sqlite:///{default_db_file}"
app.config["SQLALCHEMY_DATABASE_URI"] = database_uri

db_file = default_db_file
try:
    parsed_db_url = make_url(database_uri)
    if parsed_db_url.get_backend_name() == "sqlite" and parsed_db_url.database:
        db_file = parsed_db_url.database
except Exception:
    db_file = default_db_file

if db_file and db_file != ":memory:":
    db_dir = os.path.dirname(os.path.abspath(db_file))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

app.logger.info(
    f"Database file path: {os.path.abspath(db_file) if db_file and db_file != ':memory:' else db_file}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
migrate = Migrate(app, db)


def ensure_runtime_database_tables() -> None:
    """Ensure required ORM tables exist in the configured database."""
    try:
        expected_tables = set(db.metadata.tables.keys())
        existing_tables = set(inspect(db.engine).get_table_names())
        missing_tables = sorted(expected_tables - existing_tables)

        if not missing_tables:
            return

        app.logger.warning(
            f"Missing database tables detected at startup: {', '.join(missing_tables)}. "
            "Attempting automatic recovery via db.create_all()."
        )
        db.create_all()

        repaired_tables = set(inspect(db.engine).get_table_names())
        still_missing = sorted(expected_tables - repaired_tables)
        if still_missing:
            app.logger.error(
                f"Automatic database recovery incomplete. Still missing tables: {', '.join(still_missing)}"
            )
        else:
            app.logger.info("Database tables recovered successfully.")
    except Exception as e:
        app.logger.warning(f"Database startup schema check failed: {e}")


# ============================================================


def _request_id() -> str:
    return getattr(g, "request_id", "")


def _is_admin_api_request() -> bool:
    return request.path.startswith("/admin/api/")


def _admin_error(error: str, status_code: int, code: str, details=None):
    payload = {
        "success": False,
        "error": error,
        "code": code,
        "request_id": _request_id() or "unknown",
    }
    if details is not None:
        payload["details"] = details
    response = jsonify(payload)
    response.status_code = status_code
    return response


def _should_expose_reset_token() -> bool:
    # Never expose reset tokens in production responses.
    if env == "production":
        return False
    return bool(app.config.get("EXPOSE_RESET_TOKEN", False))


def _should_expose_recovery_token() -> bool:
    # Never expose registration recovery tokens in production responses.
    if env == "production":
        return False
    return bool(app.config.get("EXPOSE_RECOVERY_TOKEN", True))


def _config_int(name: str, default: int, minimum: int = 1) -> int:
    raw_value = app.config.get(name, default)
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return default
    return max(minimum, parsed)


def _get_import_zip_limits() -> tuple[int, int, int, int]:
    max_uncompressed = _config_int(
        "IMPORT_MAX_UNCOMPRESSED_BYTES", DEFAULT_IMPORT_MAX_UNCOMPRESSED_BYTES
    )
    max_files = _config_int("IMPORT_MAX_FILES", DEFAULT_IMPORT_MAX_FILES)
    max_single_file = _config_int(
        "IMPORT_MAX_SINGLE_FILE_BYTES", DEFAULT_IMPORT_MAX_SINGLE_FILE_BYTES
    )
    max_ratio = _config_int(
        "IMPORT_MAX_COMPRESSION_RATIO", DEFAULT_IMPORT_MAX_COMPRESSION_RATIO
    )
    return max_uncompressed, max_files, max_single_file, max_ratio


def _sanitize_log_action(action: str, max_length: int = 200) -> str:
    sanitized = "".join(
        ch if ch.isprintable() and ch not in "\r\n\t" else " " for ch in action
    )
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized[:max_length]


def _disable_sensitive_cache_headers(response):
    response.headers["Cache-Control"] = "private, no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def _json_no_store(payload, status_code: int = 200):
    response = jsonify(payload)
    response.status_code = status_code
    return _disable_sensitive_cache_headers(response)


def _regenerate_server_session() -> None:
    session.clear()
    regenerate = getattr(app.session_interface, "regenerate", None)
    if callable(regenerate):
        regenerate(session)


def _release_database_handles_for_import(reason: str = "") -> None:
    """Best-effort release of SQLAlchemy/SQLite handles before atomic import swap."""
    try:
        db.session.rollback()
    except Exception:
        pass

    try:
        db.session.remove()
    except Exception:
        pass

    try:
        db.engine.dispose()
    except Exception:
        pass

    # Trigger prompt cleanup of DB-related objects that may keep file handles.
    gc.collect()
    time.sleep(0.05)
    gc.collect()

    if reason:
        app.logger.debug(f"Import DB handles released ({reason}).")


@app.before_request
def assign_request_id():
    g.request_id = uuid.uuid4().hex


def log_user_action(action: str):
    """Helper function to log user actions with consistent formatting."""
    user = current_user.username if current_user.is_authenticated else "Anonymous"
    ip = request.remote_addr
    activity_logger.info(action, extra={"ip": ip, "user": user, "action": action})


# ============== Log Directory Size Management ===============
MAX_LOG_DIR_SIZE_MB = 5
LOG_CHECK_INTERVAL_SECONDS = 300  # Check every 5 minutes


def manage_log_directory_size():
    """Checks total log directory size and clears logs if it exceeds the limit."""
    # Use a file to store the last check time to persist across restarts/workers
    check_time_file = os.path.join(log_dir, ".last_log_check")
    try:
        with open(check_time_file, "r") as check_file:
            last_check_time = float(check_file.read())
    except (IOError, ValueError) as e:
        app.logger.warning(
            f"Could not read or parse .last_log_check file: {e}. Assuming it needs to run."
        )
        last_check_time = 0

    current_time = time.time()

    if current_time - last_check_time > LOG_CHECK_INTERVAL_SECONDS:
        with open(check_time_file, "w") as check_file:
            check_file.write(str(current_time))

        try:
            total_size = 0
            for dirpath, dirnames, filenames in os.walk(log_dir):
                for filename in filenames:
                    # Ignore the check time file itself
                    if filename == ".last_log_check":
                        continue
                    fp = os.path.join(dirpath, filename)
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)

            max_size_bytes = MAX_LOG_DIR_SIZE_MB * 1024 * 1024
            if total_size > max_size_bytes:
                app.logger.warning(
                    f"Log directory size ({total_size / 1024 / 1024:.2f}MB) exceeds limit of {MAX_LOG_DIR_SIZE_MB}MB. Clearing logs."
                )
                for dirpath, dirnames, filenames in os.walk(log_dir):
                    for filename in filenames:
                        # Use regex to match app.log, app.log.1, user_activity.log, etc.
                        if re.match(r".+\.log(\.\d+)?$", filename):
                            fp = os.path.join(dirpath, filename)
                            try:
                                # Truncate the file by opening in write mode
                                with open(fp, "w"):
                                    pass
                                app.logger.info(f"Truncated log file: {fp}")
                            except Exception as e:
                                app.logger.error(
                                    f"Could not truncate log file {fp}: {e}"
                                )
                app.logger.info("Log files have been cleared due to size limit.")
        except Exception as e:
            app.logger.error(f"Error during log directory size management: {e}")


@app.before_request
def periodic_tasks():
    manage_log_directory_size()


@app.before_request
def block_requests_during_import_swap():
    """Temporarily reject concurrent requests during critical import swap window."""
    if not import_swap_quiesce_event.is_set():
        return

    if request.path.startswith("/static/"):
        return

    if request.path in ("/health", "/admin/api/import/all", "/admin/api/import/validate"):
        return

    if request.path.startswith("/admin/api/"):
        return _admin_error(
            "Import danych w toku. Spróbuj ponownie za chwilę.",
            503,
            "IMPORT_SWAP_BUSY",
        )

    return (
        jsonify(
            {
                "success": False,
                "error": "Import danych w toku. Spróbuj ponownie za chwilę.",
                "code": "IMPORT_SWAP_BUSY",
                "request_id": _request_id() or "unknown",
            }
        ),
        503,
    )


@app.after_request
def set_security_headers(response):
    """Add security headers including CSP for external QR API"""
    # Content Security Policy - allow QR API and self
    # CRITICAL: connect-src MUST include api.qrserver.com for Fetch API in Service Worker!
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://challenges.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://challenges.cloudflare.com; "
        "img-src 'self' data: blob: https://api.qrserver.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "connect-src 'self' https://api.qrserver.com https://fonts.googleapis.com https://fonts.gstatic.com; "
        "frame-src 'self' https://challenges.cloudflare.com; "
        "manifest-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    response.headers['Content-Security-Policy'] = csp
    
    # Other security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Allow root scope for service worker served from /static/sw.js.
    if request.path == "/static/sw.js":
        response.headers["Service-Worker-Allowed"] = "/"
    if _request_id():
        response.headers["X-Request-ID"] = _request_id()

    # Normalize admin API error payloads so all responses include code + request_id.
    if _is_admin_api_request() and response.is_json:
        payload = response.get_json(silent=True)
        if isinstance(payload, dict) and payload.get("success") is False:
            if "code" not in payload:
                payload["code"] = "ADMIN_API_ERROR"
            if "request_id" not in payload:
                payload["request_id"] = _request_id() or "unknown"
            response.set_data(json.dumps(payload, ensure_ascii=False))
            response.mimetype = "application/json"

    return response


# ======================================================


# Load random data from files
def load_data_from_file(filename):
    """Helper function to load lines from a file into a list."""
    try:
        with open(os.path.join("random_data", filename), "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        logging.error(f"Data file not found: {filename}")
        return []
    except OSError as e:
        logging.error(f"Error reading data file {filename}: {e}")
        return []


male_first_names = load_data_from_file("male_first_names.txt")
female_first_names = load_data_from_file("female_first_names.txt")
last_names = load_data_from_file("last_names.txt")
warsaw_streets = load_data_from_file("warsaw_streets.txt")
warsaw_postal_codes = load_data_from_file("warsaw_postal_codes.txt")

# ============== Service Initialization ===============
access_key_service = AccessKeyService()
announcement_service = AnnouncementService()
statistics_service = StatisticsService()
notification_service = NotificationService()
chat_service = ChatService()
auth_manager = UserAuthManager(access_key_service, notification_service)
# =====================================================

# ============== Caching Setup ===============
if app.config.get("TESTING"):
    # Use NullCache for testing to completely disable caching
    cache = Cache(app, config={'CACHE_TYPE': 'NullCache'})
    app.logger.info("Cache is DISABLED for testing.")
else:
    # Use a dummy cache for development if Redis is not available.
    try:
        cache = Cache(app, config={'CACHE_TYPE': 'redis', 'CACHE_REDIS_URL': 'redis://localhost:6379/0'})
        cache.init_app(app)
        app.logger.info("Redis cache configured successfully.")
    except Exception as e:
        app.logger.warning(f"Could not configure Redis cache, falling back to simple cache. Error: {e}")
        cache = Cache(app, config={'CACHE_TYPE': 'simple'})
        cache.init_app(app)

# Conditionally disable caching for specific routes in testing mode
def cached_if_not_testing(timeout=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if app.config.get("TESTING"):
                return f(*args, **kwargs)
            return cache.cached(timeout=timeout)(f)(*args, **kwargs)
        return decorated_function
    return decorator
# ============================================

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"  # type: ignore[assignment]


@login_manager.user_loader
def load_user(user_id):
    """Loads a user from the database for Flask-Login."""
    try:
        return auth_manager.get_user_by_id(user_id)
    except OperationalError as e:
        app.logger.warning(f"Database not ready in user_loader: {e}")
        return None


@app.cli.command("init-db")
@with_appcontext
def init_db_command():
    """
    Drops all tables, recreates them, and creates a default admin user
    based on environment variables.
    """
    try:
        # Prefer migrations when available; fallback to metadata bootstrap
        # when migration repository is missing (common on fresh Windows setups).
        migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
        migrations_available = os.path.isdir(migrations_dir)
        if migrations_available:
            try:
                from flask_migrate import upgrade

                upgrade()
                click.echo("Database tables initialized via migrations.")
            except Exception as migration_error:
                click.echo(
                    click.style(
                        f"Warning: migration upgrade failed ({migration_error}). Falling back to db.create_all().",
                        fg="yellow",
                    )
                )
                db.create_all()
                click.echo("Database tables initialized via db.create_all().")
        else:
            db.create_all()
            click.echo("Database tables initialized via db.create_all().")

        ensure_runtime_database_tables()

        admin_user = app.config.get("ADMIN_USERNAME")
        admin_pass = app.config.get("ADMIN_PASSWORD")

        if not admin_user or not admin_pass:
            click.echo(
                click.style(
                    "Warning: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env file. Cannot create admin user.",
                    fg="yellow",
                )
            )
            return

        # Check if admin already exists
        if auth_manager.get_user_by_id(admin_user):
            click.echo(f"Admin user '{admin_user}' already exists. Skipping creation.")
            return

        # Generate a temporary access key for admin registration
        admin_key = access_key_service.generate_access_key(
            description=f"Initial admin key for {admin_user}", expires_days=1
        )

        success, message, _ = auth_manager.register_user(
            admin_user, admin_pass, admin_key
        )

        if success:
            click.echo(click.style(f"Admin user '{admin_user}' created successfully.", fg="green"))
        else:
            click.echo(click.style(f"Error creating admin user: {message}", fg="red"))

    except Exception as e:
        click.echo(click.style(f"An error occurred during database initialization: {e}", fg="red"))


# Initialize Limiter
# Check both app config and environment variable (env var is checked at import time)
is_testing = app.config.get("TESTING", False) or os.environ.get("FLASK_TESTING", "").lower() in ("1", "true")
limiter_enabled = not (is_testing or is_load_test_mode)

if limiter_enabled:
    limiter_storage_uri = app.config.get("RATELIMIT_STORAGE_URL", "memory://")
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per minute"],  # Increased default limits
        storage_uri=limiter_storage_uri,
        strategy="fixed-window",
    )
    app.logger.info(
        f"Limiter enabled: {limiter.enabled} (storage={limiter_storage_uri})"
    )
else:
    app.logger.info("Limiter is disabled for testing or by environment variable.")
    # Create a dummy limiter that does nothing for testing
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
        def exempt(self, f):
            return f
    limiter = DummyLimiter()

# Define the fixed input file path
FIXED_INPUT_FILE = "document_templates/pasted_content.txt"
FIXED_INPUT_FILE_NEW = "document_templates/mdowod.txt"
FIXED_INPUT_FILE_PJ = "document_templates/mprawojazdy.txt"
FIXED_INPUT_FILE_SI = "document_templates/school_id.txt"
FIXED_INPUT_FILE_STI = "document_templates/student_id.txt"

# Directory paths
USER_DATA_DIR = "user_data"
AUTH_DATA_DIR = "auth_data"

# Application version
APP_VERSION = "1.0.0"

# Admin credentials - pobierane dynamicznie dla obsługi testów
def get_admin_credentials():
    """Get admin credentials from environment variables (supports test overrides)."""
    username = os.environ.get("ADMIN_USERNAME", "admin")
    password = os.environ.get("ADMIN_PASSWORD")
    if username and password:
        return {username: password}
    return {}

ADMIN_CREDENTIALS = get_admin_credentials()


# Global error handler for HTTP errors
@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_error(e):
    code = getattr(e, "code", 500)
    message = getattr(e, "description", "Internal server error")
    if code == 404:
        message = "Resource not found."

    logging.error(f"HTTP Error {code}: {message}", exc_info=True)
    response = jsonify({"success": False, "error": message})
    response.status_code = code
    return response


def _filter_sensitive_data(data: dict) -> dict:
    """Recursively removes sensitive keys from a dictionary before logging."""
    if not isinstance(data, dict):
        return data

    filtered_data = deepcopy(data)
    sensitive_keys = [
        "password",
        "new_password",
        "token",
        "access_key",
        "recovery_token",
        "csrf_token",
    ]

    for key, value in data.items():
        if key in sensitive_keys:
            filtered_data[key] = "[REDACTED]"
        elif isinstance(value, dict):
            filtered_data[key] = _filter_sensitive_data(value)

    return filtered_data


def invalidate_users_cache():
    """Safely invalidate the users list cache."""
    try:
        cache.delete('view//admin/api/users')
    except Exception as e:
        logging.warning(f"Failed to invalidate users cache: {e}")


def require_admin_login(f):
    """Decorator to require admin login for protected routes"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("admin_logged_in"):
            # If the request is for an API endpoint, return 401 Unauthorized
            if request.path.startswith("/admin/api/"):
                return _admin_error("Authentication required", 401, "ADMIN_AUTH_REQUIRED")
            # Otherwise, redirect to the login page
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)

    return decorated_function


def create_user_folder(user_name: str) -> tuple[str, str, str]:
    """Create user-specific folders for files and logs.
    
    Args:
        user_name: The username to create folders for.
        
    Returns:
        A tuple of (user_folder, files_folder, logs_folder) paths.
    """
    normalized_user_name = (user_name or "").strip()
    if not is_valid_username(normalized_user_name):
        raise ValueError("Nieprawidlowa nazwa uzytkownika")
    if len(normalized_user_name) > 50:
        raise ValueError("Nieprawidlowa nazwa uzytkownika")

    user_folder = os.path.join(USER_DATA_DIR, normalized_user_name)
    files_folder = os.path.join(user_folder, "files")
    logs_folder = os.path.join(user_folder, "logs")

    base_dir_abs = os.path.abspath(USER_DATA_DIR)
    user_folder_abs = os.path.abspath(user_folder)
    files_folder_abs = os.path.abspath(files_folder)
    logs_folder_abs = os.path.abspath(logs_folder)
    if not all(
        os.path.commonpath((base_dir_abs, candidate)) == base_dir_abs
        for candidate in (user_folder_abs, files_folder_abs, logs_folder_abs)
    ):
        raise ValueError("Nieprawidlowa nazwa uzytkownika")

    os.makedirs(files_folder, exist_ok=True)
    os.makedirs(logs_folder, exist_ok=True)

    return user_folder, files_folder, logs_folder


def replace_html_data(input_soup, new_data):
    """
    Replace data in HTML using BeautifulSoup
    Safely handles None values by converting them to empty strings and sanitizes input.
    """

    # Helper function to safely get and clean value from new_data
    def safe_get(key, default=""):
        value = new_data.get(key, default)
        # Sanitize the value to prevent XSS - strip ALL HTML tags
        return bleach.clean(str(value) if value is not None else default, tags=[], attributes={}, strip=True)

    # This function will contain the data replacement logic
    # It takes a BeautifulSoup object (input_soup) and new_data dictionary
    # and modifies the soup in place.

    # Dane w sekcji main (id='praw')
    # Używamy find_previous_sibling, aby znaleźć element <p> przed etykietą

    # Imię
    name_label = input_soup.find("p", class_="sub", string="Imię (Imiona)")
    if name_label:
        name_value = name_label.find_previous_sibling("p")
        if name_value:
            name_value.string = safe_get("imie")

    # Nazwisko
    surname_label = input_soup.find("p", class_="sub", string="Nazwiskо")
    if surname_label:
        surname_value = surname_label.find_previous_sibling("p")
        if surname_value:
            surname_value.string = safe_get("nazwisko")

    # Obywatelstwo
    citizenship_label = input_soup.find("p", class_="sub", string="Obywatelstwo")
    if citizenship_label:
        citizenship_value = citizenship_label.find_previous_sibling("p")
        if citizenship_value:
            citizenship_value.string = safe_get("obywatelstwo")

    # Data urodzenia
    dob_label = input_soup.find("p", class_="sub", string="Data urodzenia")
    if dob_label:
        dob_value = dob_label.find_previous_sibling("p")
        if dob_value:
            dob_value.string = safe_get("data_urodzenia")

    # Numer PESEL
    pesel_label = input_soup.find("p", class_="sub", string="Numer PЕSEL")
    if pesel_label:
        pesel_value = pesel_label.find_previous_sibling("p")
        if pesel_value:
            pesel_value.string = safe_get("pesel")

    # Dane w sekcji danebox (główne dane mDowodu)
    # Seria i numer
    seria_numer_mdowod_label = input_soup.find(
        "p", class_="info", string=re.compile(r"Seri. i numer")
    )
    if seria_numer_mdowod_label:
        seria_numer_mdowod_value = seria_numer_mdowod_label.find_next_sibling(
            "p", class_="main"
        )
        if seria_numer_mdowod_value:
            seria_numer_mdowod_value.string = safe_get("seria_numer_mdowodu")

    # Termin ważności
    termin_waznosci_mdowod_label = input_soup.find(
        "p", class_="info", string=re.compile(r"Termin w[aа]żno[śs]ci")
    )
    if termin_waznosci_mdowod_label:
        termin_waznosci_mdowod_value = termin_waznosci_mdowod_label.find_next_sibling(
            "p", class_="main"
        )
        if termin_waznosci_mdowod_value:
            termin_waznosci_mdowod_value.string = safe_get("termin_waznosci_mdowodu")

    # Data wydania
    data_wydania_mdowod_label = input_soup.find(
        "p", class_="info", string=re.compile(r"Data wydani[aа]")
    )
    if data_wydania_mdowod_label:
        data_wydania_mdowod_value = data_wydania_mdowod_label.find_next_sibling(
            "p", class_="main"
        )
        if data_wydania_mdowod_value:
            data_wydania_mdowod_value.string = safe_get("data_wydania_mdowodu")

    # Imię ojca
    imie_ojca_mdowod_label = input_soup.find("p", class_="info", string="Imię ojcа")
    if imie_ojca_mdowod_label:
        imie_ojca_mdowod_value = imie_ojca_mdowod_label.find_next_sibling(
            "p", class_="main"
        )
        if imie_ojca_mdowod_value:
            imie_ojca_mdowod_value.string = safe_get("imie_ojca_mdowod")

    # Imię matki
    imie_matki_mdowod_label = input_soup.find("p", class_="info", string="Imię mаtki")
    if imie_matki_mdowod_label:
        imie_matki_mdowod_value = imie_matki_mdowod_label.find_next_sibling(
            "p", class_="main"
        )
        if imie_matki_mdowod_value:
            imie_matki_mdowod_value.string = safe_get("imie_matki_mdowod")

    # Dane w sekcji danedowodu (dane dowodu osobistego)
    # Seria i numer
    seria_numer_dowod_section = input_soup.find("section", id="danedowodu")
    if seria_numer_dowod_section:
        # Seria i numer
        seria_numer_dowod_label = seria_numer_dowod_section.find(
            "p", class_="info", string=re.compile(r"S[eе]ria i numer")
        )
        if seria_numer_dowod_label:
            seria_numer_dowod_value = seria_numer_dowod_label.find_next_sibling(
                "p", class_="main"
            )
            if seria_numer_dowod_value:
                seria_numer_dowod_value.string = safe_get("seria_numer_dowodu")

        # Termin ważności
        termin_waznosci_dowod_label = seria_numer_dowod_section.find(
            "p", class_="info", string="Tеrmin ważności"
        )
        if termin_waznosci_dowod_label:
            termin_waznosci_dowod_value = termin_waznosci_dowod_label.find_next_sibling(
                "p", class_="main"
            )
            if termin_waznosci_dowod_value:
                termin_waznosci_dowod_value.string = safe_get("termin_waznosci_dowodu")

        # Data wydania
        data_wydania_dowod_label = seria_numer_dowod_section.find(
            "p", class_="info", string=re.compile(r"Data wydani.")
        )
        if data_wydania_dowod_label:
            data_wydania_dowod_value = data_wydania_dowod_label.find_next_sibling(
                "p", class_="main"
            )
            if data_wydania_dowod_value:
                data_wydania_dowod_value.string = safe_get("data_wydania_dowodu")

    # Dane w sekcji rogo (dodatkowe dane)
    # Płeć
    plec_label = input_soup.find("p", class_="info", string="Płеć")
    if plec_label:
        plec_value = plec_label.find_next_sibling("p", class_="main")
        if plec_value:
            gender_map = {"M": "Mężczyzna", "K": "Kobieta"}
            plec_value.string = gender_map.get(safe_get("plec"), safe_get("plec"))

    # Nazwisko rodowe
    nazwisko_rodowe_label = input_soup.find(
        "p", class_="info", string="Nazwisko rodowe"
    )
    if nazwisko_rodowe_label:
        nazwisko_rodowe_value = nazwisko_rodowe_label.find_next_sibling(
            "p", class_="main"
        )
        if nazwisko_rodowe_value:
            nazwisko_rodowe_value.string = safe_get("nazwisko_rodowe").capitalize()

    # Nazwisko rodowe ojca
    nazwisko_rodowe_ojca_label = input_soup.find(
        "p", class_="info", string="Nazwiskо rodowе ojca"
    )
    if nazwisko_rodowe_ojca_label:
        nazwisko_rodowe_ojca_value = nazwisko_rodowe_ojca_label.find_next_sibling(
            "p", class_="main"
        )
        if nazwisko_rodowe_ojca_value:
            nazwisko_rodowe_ojca_value.string = safe_get(
                "nazwisko_rodowe_ojca"
            ).capitalize()

    # Nazwisko rodowe matki
    nazwisko_rodowe_matki_label = input_soup.find(
        "p", class_="info", string="Nazwiskо rodowе matki"
    )
    if nazwisko_rodowe_matki_label:
        nazwisko_rodowe_matki_value = nazwisko_rodowe_matki_label.find_next_sibling(
            "p", class_="main"
        )
        if nazwisko_rodowe_matki_value:
            nazwisko_rodowe_matki_value.string = safe_get(
                "nazwisko_rodowe_matki"
            ).capitalize()

    # Miejsce urodzenia
    miejsce_urodzenia_label = input_soup.find(
        "p", class_="info", string="Miejsce urоdzenia"
    )
    if miejsce_urodzenia_label:
        miejsce_urodzenia_value = miejsce_urodzenia_label.find_next_sibling(
            "p", class_="main"
        )
        if miejsce_urodzenia_value:
            miejsce_urodzenia_value.string = safe_get("miejsce_urodzenia").capitalize()

    # Adres zameldowania
    adres_zameldowania_label = input_soup.find(
        "p", class_="info", string="Аdres zameldоwania na pobyt stały"
    )
    if adres_zameldowania_label:
        adres_zameldowania_value = adres_zameldowania_label.find_next_sibling(
            "p", class_="main"
        )
        if adres_zameldowania_value:
            adres_zameldowania_value.string = safe_get(
                "adres_zameldowania"
            ).capitalize()

    # Data zameldowania
    data_zameldowania_label = input_soup.find(
        "p", class_="info", string="Data zameldоwaniа na pobyt stały"
    )
    if data_zameldowania_label:
        data_zameldowania_value = data_zameldowania_label.find_next_sibling(
            "p", class_="main"
        )
        if data_zameldowania_value:
            data_zameldowania_value.string = safe_get("data_zameldowania").capitalize()
    return input_soup


def calculate_file_hash(filepath: str) -> str | None:
    """Calculate SHA256 hash of a file.
    
    Args:
        filepath: Path to the file to hash.
        
    Returns:
        The SHA256 hash as a hex string, or None if the file doesn't exist or an error occurs.
    """
    if not os.path.exists(filepath):
        return None
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception as e:
        logging.error(f"Error calculating hash for {filepath}: {e}")
        return None


ALLOWED_IMPORT_ROOTS = {"user_data", "auth_data"}
REQUIRED_IMPORT_DB_TABLES = {"users"}
REQUIRED_USERS_COLUMNS = {"username", "password"}
DEFAULT_IMPORT_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024
DEFAULT_IMPORT_MAX_FILES = 10_000
DEFAULT_IMPORT_MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024
DEFAULT_IMPORT_MAX_COMPRESSION_RATIO = 100


def _schema_update_spec() -> tuple[dict[str, list[tuple[str, str]]], list[str]]:
    schema_updates: dict[str, list[tuple[str, str]]] = {
        "users": [
            ("created_at", "ALTER TABLE users ADD COLUMN created_at DATETIME"),
            ("is_active", "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"),
            ("last_login", "ALTER TABLE users ADD COLUMN last_login DATETIME"),
            ("access_key_used", "ALTER TABLE users ADD COLUMN access_key_used TEXT"),
            ("hubert_coins", "ALTER TABLE users ADD COLUMN hubert_coins INTEGER NOT NULL DEFAULT 0"),
            ("password_reset_token", "ALTER TABLE users ADD COLUMN password_reset_token TEXT"),
            ("password_reset_expires", "ALTER TABLE users ADD COLUMN password_reset_expires DATETIME"),
            ("recovery_token", "ALTER TABLE users ADD COLUMN recovery_token TEXT"),
            ("recovery_token_expires", "ALTER TABLE users ADD COLUMN recovery_token_expires DATETIME"),
            ("has_seen_tutorial", "ALTER TABLE users ADD COLUMN has_seen_tutorial BOOLEAN NOT NULL DEFAULT 0"),
            ("last_global_chat_seen_id", "ALTER TABLE users ADD COLUMN last_global_chat_seen_id INTEGER"),
        ],
        "access_keys": [
            ("description", "ALTER TABLE access_keys ADD COLUMN description TEXT"),
            ("created_at", "ALTER TABLE access_keys ADD COLUMN created_at DATETIME"),
            ("expires_at", "ALTER TABLE access_keys ADD COLUMN expires_at DATETIME"),
            ("is_active", "ALTER TABLE access_keys ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"),
            ("used_count", "ALTER TABLE access_keys ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0"),
            ("last_used", "ALTER TABLE access_keys ADD COLUMN last_used DATETIME"),
        ],
        "notifications": [
            ("is_read", "ALTER TABLE notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT 0"),
            ("created_at", "ALTER TABLE notifications ADD COLUMN created_at DATETIME"),
        ],
        "announcements": [
            ("type", "ALTER TABLE announcements ADD COLUMN type TEXT NOT NULL DEFAULT 'info'"),
            ("created_at", "ALTER TABLE announcements ADD COLUMN created_at DATETIME"),
            ("expires_at", "ALTER TABLE announcements ADD COLUMN expires_at DATETIME"),
            ("is_active", "ALTER TABLE announcements ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"),
        ],
        "files": [
            ("file_hash", "ALTER TABLE files ADD COLUMN file_hash TEXT"),
        ],
    }
    index_updates = [
        "CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)",
        "CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token)",
        "CREATE INDEX IF NOT EXISTS idx_users_recovery_token ON users(recovery_token)",
        "CREATE INDEX IF NOT EXISTS idx_users_recovery_token_expires ON users(recovery_token_expires)",
        "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active)",
        "CREATE INDEX IF NOT EXISTS idx_files_user_username ON files(user_username)",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)",
    ]
    return schema_updates, index_updates


def _collect_schema_updates(cursor: sqlite3.Cursor) -> tuple[list[tuple[str, str, str]], list[str]]:
    schema_updates, _ = _schema_update_spec()
    existing_tables = {
        row[0]
        for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    pending_updates: list[tuple[str, str, str]] = []
    missing_tables: list[str] = []

    for table_name, columns in schema_updates.items():
        if table_name not in existing_tables:
            missing_tables.append(table_name)
            continue

        existing_columns = {
            row[1] for row in cursor.execute(f"PRAGMA table_info({table_name})")
        }
        for column_name, alter_stmt in columns:
            if column_name in existing_columns:
                continue
            pending_updates.append((table_name, column_name, alter_stmt))

    return pending_updates, missing_tables


def preview_sqlite_schema_compatibility(db_path: str) -> tuple[bool, list[str], list[str]]:
    if not os.path.exists(db_path):
        return False, [], ["Brak pliku bazy danych w archiwum."]

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            pending_updates, missing_tables = _collect_schema_updates(cursor)
            preview = [f"create_table:{table}" for table in missing_tables]
            preview.extend(
                [f"{table_name}.{column_name}" for table_name, column_name, _ in pending_updates]
            )
            return True, preview, []
    except sqlite3.Error as e:
        return False, [], [f"Błąd odczytu schematu SQLite: {e}"]


def ensure_sqlite_schema_compatibility(db_path: str) -> tuple[bool, list[str], list[str]]:
    if not os.path.exists(db_path):
        return False, [], ["Brak pliku bazy danych po imporcie."]

    engine = None
    try:
        engine = create_engine(f"sqlite:///{db_path}")
        db.metadata.create_all(bind=engine)
    except Exception as e:
        logging.error(
            f"Błąd tworzenia brakujących tabel podczas importu: {e}",
            exc_info=True,
        )
        return False, [], [f"Błąd tworzenia brakujących tabel: {e}"]
    finally:
        if engine is not None:
            engine.dispose()

    applied_updates: list[str] = []
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            pending_updates, _ = _collect_schema_updates(cursor)
            _, index_updates = _schema_update_spec()

            for table_name, column_name, alter_stmt in pending_updates:
                cursor.execute(alter_stmt)
                applied_updates.append(f"{table_name}.{column_name}")

            for index_stmt in index_updates:
                try:
                    cursor.execute(index_stmt)
                except sqlite3.Error as index_error:
                    logging.warning(
                        f"Nie udało się utworzyć indeksu kompatybilności: {index_error}"
                    )

            conn.commit()
    except sqlite3.Error as e:
        logging.error(
            f"Błąd podczas dostosowywania schematu importowanej bazy: {e}",
            exc_info=True,
        )
        return False, applied_updates, [str(e)]

    if applied_updates:
        app.logger.warning(
            f"Zastosowano poprawki kompatybilności schematu: {', '.join(applied_updates)}"
        )

    return True, applied_updates, []


with app.app_context():
    ensure_runtime_database_tables()
    try:
        schema_ok, schema_updates_applied, schema_errors = ensure_sqlite_schema_compatibility(db_file)
        if schema_ok and schema_updates_applied:
            app.logger.info(
                f"Runtime schema compatibility updates applied: {', '.join(schema_updates_applied)}"
            )
        elif not schema_ok and schema_errors:
            app.logger.warning(
                f"Runtime schema compatibility failed: {'; '.join(schema_errors)}"
            )
    except Exception as schema_error:
        app.logger.warning(f"Runtime schema compatibility check failed: {schema_error}")


def validate_imported_database(db_path: str) -> tuple[bool, list[str]]:
    issues: list[str] = []
    if not os.path.exists(db_path):
        return False, ["Archiwum nie zawiera pliku auth_data/database.db."]

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            integrity_result = cursor.execute("PRAGMA integrity_check").fetchone()
            if not integrity_result or integrity_result[0] != "ok":
                issues.append("Baza SQLite nie przeszła PRAGMA integrity_check.")

            tables = {
                row[0]
                for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            missing_tables = REQUIRED_IMPORT_DB_TABLES - tables
            if missing_tables:
                issues.append(
                    f"Brak wymaganych tabel: {', '.join(sorted(missing_tables))}."
                )

            if "users" in tables:
                user_columns = {
                    row[1] for row in cursor.execute("PRAGMA table_info(users)")
                }
                missing_user_columns = REQUIRED_USERS_COLUMNS - user_columns
                if missing_user_columns:
                    issues.append(
                        f"Tabela users nie zawiera wymaganych kolumn: {', '.join(sorted(missing_user_columns))}."
                    )
    except sqlite3.Error as e:
        issues.append(f"Błąd odczytu bazy SQLite: {e}")

    return len(issues) == 0, issues


def validate_backup_zip_structure(zip_path: str) -> tuple[bool, list[str]]:
    issues: list[str] = []
    roots_seen: set[str] = set()
    (
        max_uncompressed_bytes,
        max_files,
        max_single_file_bytes,
        max_compression_ratio,
    ) = _get_import_zip_limits()
    total_uncompressed_size = 0
    file_count = 0

    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            members = zip_ref.infolist()
            if not members:
                return False, ["Archiwum ZIP jest puste."]

            for member_info in members:
                member = member_info.filename
                normalized = member.replace("\\", "/").strip()
                if not normalized:
                    continue
                if "\x00" in normalized:
                    issues.append(f"Niedozwolony znak NULL w ścieżce: {member}")
                    continue
                if normalized.startswith("/") or re.match(r"^[a-zA-Z]:", normalized):
                    issues.append(f"Niedozwolona ścieżka absolutna: {member}")
                    continue

                # Reject symlinks in archive to avoid traversal via link extraction.
                mode = (member_info.external_attr >> 16) & 0o170000
                if mode == stat.S_IFLNK:
                    issues.append(f"Niedozwolony symlink w archiwum: {member}")
                    continue

                parts = [p for p in PurePosixPath(normalized).parts if p not in ("", ".")]
                if not parts:
                    continue
                if any(part == ".." for part in parts):
                    issues.append(f"Wykryto path traversal w ścieżce: {member}")
                    continue

                root_dir = parts[0]
                if root_dir not in ALLOWED_IMPORT_ROOTS:
                    issues.append(
                        f"Niedozwolona ścieżka w archiwum: {member}. Dozwolone: user_data/ i auth_data/."
                    )
                    continue
                roots_seen.add(root_dir)

                if member_info.is_dir():
                    continue

                file_count += 1
                total_uncompressed_size += member_info.file_size

                if file_count > max_files:
                    issues.append(
                        f"Archiwum zawiera zbyt wiele plików ({file_count} > {max_files})."
                    )
                if member_info.file_size > max_single_file_bytes:
                    issues.append(
                        f"Plik {member} przekracza dopuszczalny rozmiar po rozpakowaniu "
                        f"({member_info.file_size} > {max_single_file_bytes} bajtów)."
                    )
                if total_uncompressed_size > max_uncompressed_bytes:
                    issues.append(
                        "Suma rozmiarów plików po rozpakowaniu przekracza dopuszczalny limit "
                        f"({total_uncompressed_size} > {max_uncompressed_bytes} bajtów)."
                    )

                compressed_size = member_info.compress_size
                if compressed_size <= 0:
                    if member_info.file_size > 0:
                        issues.append(
                            f"Plik {member} ma nieprawidłowy rozmiar skompresowany (0 bajtów)."
                        )
                else:
                    compression_ratio = member_info.file_size / compressed_size
                    if compression_ratio > max_compression_ratio:
                        issues.append(
                            f"Plik {member} przekracza maksymalny współczynnik kompresji "
                            f"({compression_ratio:.2f} > {max_compression_ratio})."
                        )

        for required_root in ALLOWED_IMPORT_ROOTS:
            if required_root not in roots_seen:
                issues.append(f"Brak katalogu {required_root}/ w archiwum.")
    except zipfile.BadZipFile:
        issues.append("Nieprawidłowy format ZIP.")
    except Exception as e:
        issues.append(f"Błąd walidacji archiwum: {e}")

    return len(issues) == 0, issues


def swap_import_data_with_rollback(
    staged_root: str, base_path: str, import_id: str
) -> tuple[bool, str]:
    staged_user_data = os.path.join(staged_root, USER_DATA_DIR)
    staged_auth_data = os.path.join(staged_root, AUTH_DATA_DIR)
    current_user_data = os.path.join(base_path, USER_DATA_DIR)
    current_auth_data = os.path.join(base_path, AUTH_DATA_DIR)

    if not os.path.isdir(staged_user_data) or not os.path.isdir(staged_auth_data):
        return False, "Archiwum po ekstrakcji nie zawiera wymaganych katalogów user_data/ i auth_data/."

    backup_user_data = os.path.join(base_path, f"{USER_DATA_DIR}.backup.{import_id}")
    backup_auth_data = os.path.join(base_path, f"{AUTH_DATA_DIR}.backup.{import_id}")

    user_backed_up = False
    auth_backed_up = False
    user_swapped = False
    auth_swapped = False

    def _replace_dir_with_retry(
        src: str,
        dst: str,
        operation_label: str,
        retries: int = 12,
        initial_delay: float = 0.25,
    ) -> tuple[bool, str]:
        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                os.replace(src, dst)
                return True, ""
            except PermissionError as e:
                last_error = e
                if attempt < retries:
                    wait_for = initial_delay * attempt
                    _release_database_handles_for_import(operation_label)
                    logging.warning(
                        f"{operation_label}: PermissionError przy próbie {attempt}/{retries}. "
                        f"Ponawiam za {wait_for:.2f}s. Błąd: {e}"
                    )
                    time.sleep(wait_for)
                else:
                    logging.error(
                        f"{operation_label}: PermissionError po {retries} próbach: {e}"
                    )
            except Exception as e:
                last_error = e
                logging.error(
                    f"{operation_label}: błąd podczas os.replace({src}, {dst}): {e}",
                    exc_info=True,
                )
                break
        return False, str(last_error) if last_error else "Nieznany błąd podmiany katalogu."

    def _copy_dir_contents(src: str, dst: str, operation_label: str) -> tuple[bool, str]:
        """Fallback: copy files one-by-one into existing directory (Windows-safe)."""
        try:
            os.makedirs(dst, exist_ok=True)
            for root, dirs, files in os.walk(src):
                rel = os.path.relpath(root, src)
                dst_root = os.path.join(dst, rel) if rel != "." else dst
                os.makedirs(dst_root, exist_ok=True)
                for fname in files:
                    src_file = os.path.join(root, fname)
                    dst_file = os.path.join(dst_root, fname)
                    shutil.copy2(src_file, dst_file)
            return True, ""
        except Exception as e:
            logging.error(
                f"{operation_label}: fallback copy failed: {e}", exc_info=True
            )
            return False, str(e)

    try:
        if os.path.exists(backup_user_data):
            shutil.rmtree(backup_user_data, ignore_errors=True)
        if os.path.exists(backup_auth_data):
            shutil.rmtree(backup_auth_data, ignore_errors=True)

        if os.path.exists(current_user_data):
            moved, move_error = _replace_dir_with_retry(
                current_user_data,
                backup_user_data,
                "Backup katalogu user_data",
            )
            if not moved:
                logging.warning(
                    "Atomic rename of user_data failed (likely Windows file lock). "
                    "Falling back to file-by-file copy for backup."
                )
                copied, copy_error = _copy_dir_contents(
                    current_user_data, backup_user_data, "Backup user_data (fallback copy)"
                )
                if not copied:
                    raise RuntimeError(f"Nie udało się wykonać backupu user_data: {copy_error}")
            user_backed_up = True
        if os.path.exists(current_auth_data):
            moved, move_error = _replace_dir_with_retry(
                current_auth_data,
                backup_auth_data,
                "Backup katalogu auth_data",
            )
            if not moved:
                # Windows fallback: copy auth_data to backup instead of atomic rename
                logging.warning(
                    "Atomic rename of auth_data failed (likely Windows file lock). "
                    "Falling back to file-by-file copy for backup."
                )
                copied, copy_error = _copy_dir_contents(
                    current_auth_data, backup_auth_data, "Backup auth_data (fallback copy)"
                )
                if not copied:
                    raise RuntimeError(f"Nie udało się wykonać backupu auth_data: {copy_error}")
            auth_backed_up = True

        moved, move_error = _replace_dir_with_retry(
            staged_user_data,
            current_user_data,
            "Podmiana katalogu user_data",
        )
        if not moved:
            logging.warning(
                "Atomic rename of staged user_data failed (likely Windows file lock). "
                "Falling back to file-by-file overwrite."
            )
            copied, copy_error = _copy_dir_contents(
                staged_user_data, current_user_data, "Podmiana user_data (fallback copy)"
            )
            if not copied:
                raise RuntimeError(f"Nie udało się podmienić user_data: {copy_error}")
        user_swapped = True

        moved, move_error = _replace_dir_with_retry(
            staged_auth_data,
            current_auth_data,
            "Podmiana katalogu auth_data",
        )
        if not moved:
            # Windows fallback: copy staged auth_data files into current_auth_data
            logging.warning(
                "Atomic rename of staged auth_data failed (likely Windows file lock). "
                "Falling back to file-by-file overwrite."
            )
            copied, copy_error = _copy_dir_contents(
                staged_auth_data, current_auth_data, "Podmiana auth_data (fallback copy)"
            )
            if not copied:
                raise RuntimeError(f"Nie udało się podmienić auth_data: {copy_error}")
        auth_swapped = True

        if user_backed_up and os.path.exists(backup_user_data):
            shutil.rmtree(backup_user_data, ignore_errors=True)
        if auth_backed_up and os.path.exists(backup_auth_data):
            shutil.rmtree(backup_auth_data, ignore_errors=True)

        return True, ""
    except Exception as e:
        logging.error(f"Swap danych importu nie powiódł się: {e}", exc_info=True)
        try:
            if user_swapped and os.path.exists(current_user_data):
                shutil.rmtree(current_user_data, ignore_errors=True)
            if auth_swapped and os.path.exists(current_auth_data):
                shutil.rmtree(current_auth_data, ignore_errors=True)
            if user_backed_up and os.path.exists(backup_user_data):
                try:
                    os.replace(backup_user_data, current_user_data)
                except PermissionError:
                    _copy_dir_contents(backup_user_data, current_user_data, "Rollback user_data")
            if auth_backed_up and os.path.exists(backup_auth_data):
                try:
                    os.replace(backup_auth_data, current_auth_data)
                except PermissionError:
                    _copy_dir_contents(backup_auth_data, current_auth_data, "Rollback auth_data")
        except Exception as rollback_error:
            logging.error(
                f"Rollback importu nie powiódł się: {rollback_error}",
                exc_info=True,
            )
        return False, str(e)


@app.route("/set_user", methods=["POST"])
def set_user():
    """Set user name in session"""
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(
                {"success": False, "error": "Nieprawidłowy format danych żądania"}
            ), 400

        user_name = data.get("user_name")

        if not user_name:
            return jsonify(
                {"success": False, "error": "Nazwa użytkownika jest wymagana"}
            )
        if not isinstance(user_name, str):
            return jsonify(
                {"success": False, "error": "Nazwa użytkownika jest nieprawidłowa"}
            ), 400

        user_name = user_name.strip()

        # Validate user name (basic validation)
        if len(user_name) < 2 or len(user_name) > 50:
            return jsonify(
                {
                    "success": False,
                    "error": "Nazwa użytkownika musi mieć od 2 do 50 znaków",
                }
            )
        if not is_valid_username(user_name):
            return jsonify(
                {
                    "success": False,
                    "error": "Nazwa użytkownika zawiera niedozwolone znaki",
                }
            ), 400

        # Store in session
        session["user_name"] = user_name

        # Create user folder
        create_user_folder(user_name)
        logging.info(
            "User set username",
            extra={"user": user_name, "ip": request.environ.get("REMOTE_ADDR")},
        )

        return jsonify(
            {"success": True, "message": "Nazwa użytkownika ustawiona pomyślnie"}
        )
    except Exception as e:
        logging.error(f"Error setting user name: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas ustawiania nazwy użytkownika",
            }
        )


@app.route("/get_example_data", methods=["GET"])
def get_example_data():
    """Return example data for form filling"""
    example_data = {
        "imie": "Jan",
        "nazwisko": "Kowalski",
        "obywatelstwo": "Polskie",
        "data_urodzenia": "01.01.1990",
        "pesel": "90010112345",
    }
    return jsonify(example_data)


@app.route("/generate_pesel", methods=["POST"])
def handle_generate_pesel():
    """Generate PESEL number based on birth date and gender"""
    try:
        data = request.get_json()
        birth_date = data.get("birth_date")
        gender = data.get("gender")

        if not birth_date or not gender:
            return jsonify(
                {"success": False, "error": "Data urodzenia i płeć są wymagane"}
            ), 400

        # Użycie funkcji generate_pesel z pesel_generator.py
        pesel = generate_pesel(birth_date, gender)

        return jsonify({"success": True, "pesel": pesel})
    except ValueError as e:
        logging.error(f"Error generating PESEL: {e}")
        # Przekaż konkretny błąd walidacji do frontendu
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logging.error(f"Error generating PESEL: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił nieoczekiwany błąd podczas generowania numeru PESEL",
            }
        ), 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {"status": "ok", "timestamp": datetime.now().isoformat(), "version": APP_VERSION}
    )


@app.route("/forgot_password", methods=["POST"])
@limiter.limit("5 per minute")  # Prevent user enumeration attacks
def forgot_password():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()

        if not username:
            return jsonify(
                {"success": False, "error": "Nazwa użytkownika jest wymagana"}
            ), 400

        token = auth_manager.generate_password_reset_token(username)
        response_payload = {
            "success": True,
            "message": "Jeśli użytkownik istnieje, link do resetowania hasła został wysłany.",
        }
        # Token can be exposed only outside production and only when explicitly enabled.
        if token and _should_expose_reset_token():
            response_payload["token"] = token
        return jsonify(response_payload), 200
    except Exception as e:
        logging.error(f"Error in forgot password: {e}")
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas przetwarzania żądania"}
        ), 500


@app.before_request
def log_request_info():
    """Log information about each incoming request."""
    # Only log in development mode and filter sensitive data
    if app.debug:
        app.logger.debug(
            f"Request: {request.method} {request.path} from {request.remote_addr}"
        )
        # Don't log request body - may contain passwords and tokens


@app.route("/reset_password", methods=["POST"])
@limiter.limit("10 per minute")  # Prevent brute-force on reset tokens
def reset_password():
    try:
        data = request.get_json()
        token = data.get("token", "").strip()
        new_password = data.get("new_password", "")

        if not token or not new_password:
            return jsonify(
                {"success": False, "error": "Token i nowe hasło są wymagane"}
            ), 400

        success, message = auth_manager.reset_user_password_with_token(
            token, new_password
        )
        if success:
            logging.info("Password reset successful.")
            return jsonify({"success": True, "message": message})
        else:
            logging.warning(f"Password reset failed: {message}")
            return jsonify({"success": False, "error": message}), 400
    except Exception as e:
        logging.error(f"Error in reset password: {e}")
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas resetowania hasła"}
        ), 500


@app.route("/recover_password_page")
def recover_password_page():
    return render_template("recover_password_page.html", csrf_token_func=generate_csrf)


@app.route("/recover_password", methods=["POST"])
@limiter.limit("10 per minute")  # Prevent brute-force on recovery tokens
def recover_password():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        recovery_token = data.get("recovery_token", "").strip()
        new_password = data.get("new_password", "")

        if not username or not recovery_token or not new_password:
            return jsonify(
                {"success": False, "error": "Wszystkie pola są wymagane"}
            ), 400

        success, message = auth_manager.reset_password_with_recovery_token(
            username, recovery_token, new_password
        )
        if success:
            logging.info(f"Password recovered for user: {username}")
            return jsonify({"success": True, "message": message})
        else:
            logging.warning(
                f"Password recovery failed for user: {username} - {message}"
            )
            return jsonify({"success": False, "error": message}), 400
    except Exception as e:
        logging.error(f"Error in recover password: {e}")
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas odzyskiwania hasła"}
        ), 500


@app.before_request
def check_user_status():
    # Exclude routes that don't require login or are part of the login/logout process
    if request.endpoint in [
        "login",
        "register",
        "logout",
        "admin_login",
        "static",
        "health_check",
        "set_user",
        "get_example_data",
        "handle_generate_pesel",
        "forgot_password",
        "reset_password",
        "recover_password_page",
        "init_db_command",  # Exclude the new CLI command
    ]:
        return

    try:
        # Flask-Login handles user session management.
        # This function can be used for other global checks if needed,
        # but manual session management is removed to avoid conflicts.
        if current_user.is_authenticated and not current_user.is_active:
            logout_user()
            logging.warning(
                f"Deactivated user {current_user.username} attempted to access protected route. Session cleared."
            )
            return redirect(
                url_for(
                    "login",
                    message="Twoje konto zostało dezaktywowane lub usunięte. Zaloguj się ponownie.",
                )
            )
    except OperationalError as e:
        app.logger.warning(
            f"Database not ready, skipping user status check: {e}"
        )


@app.route("/api/generate-random-data", methods=["GET"])
def api_generate_random_data():
    """Generates random data for the form based on specified rules.
    ---
    get:
      description: Generates a complete set of random data for a user profile.
      parameters:
        - name: plec
          in: query
          type: string
          required: false
          enum: ['M', 'K']
          description: Gender of the user (M for Male, K for Female). If not provided, a random gender will be chosen.
      responses:
        200:
          description: A JSON object with randomly generated user data.
          schema:
            type: object
            properties:
              imie:
                type: string
                example: 'JAN'
              nazwisko:
                type: string
                example: 'KOWALSKI'
              pesel:
                type: string
                example: '90010112345'
        500:
          description: Internal server error if data generation fails.
    """
    try:
        # Get gender from request arguments, default to a random choice if not provided
        plec_param = request.args.get("plec")
        if plec_param and plec_param in ["M", "K"]:
            plec = "Mężczyzna" if plec_param == "M" else "Kobieta"
        else:
            plec = random.choice(["Mężczyzna", "Kobieta"])

        # Generate normally capitalized names first
        if plec == "Kobieta":
            imie_normal_case = random.choice(female_first_names)
            nazwisko_normal_case = random.choice(last_names)
            if nazwisko_normal_case.endswith("ski"):
                nazwisko_normal_case = nazwisko_normal_case[:-3] + "ska"
            elif nazwisko_normal_case.endswith("cki"):
                nazwisko_normal_case = nazwisko_normal_case[:-3] + "cka"
        else:
            imie_normal_case = random.choice(male_first_names)
            nazwisko_normal_case = random.choice(last_names)
            if nazwisko_normal_case.endswith("ska"):
                nazwisko_normal_case = nazwisko_normal_case[:-3] + "ski"
            elif nazwisko_normal_case.endswith("cka"):
                nazwisko_normal_case = nazwisko_normal_case[:-3] + "cki"

        # Create uppercase versions for main fields
        imie = imie_normal_case.upper()
        nazwisko = nazwisko_normal_case.upper()

        imie_ojca_mdowod = random.choice(male_first_names).upper()
        imie_matki_mdowod = random.choice(female_first_names).upper()

        # Rule - mother's maiden name must be different and normally capitalized
        while True:
            nazwisko_rodowe_matki = random.choice(last_names)
            if nazwisko_rodowe_matki.endswith("ski"):
                nazwisko_rodowe_matki = nazwisko_rodowe_matki[:-3] + "ska"
            if nazwisko_rodowe_matki != nazwisko_normal_case:
                break

        # Rule 3: Date of birth (exactly 18 years old)
        today = datetime.now()
        birth_date_dt = today - timedelta(days=18 * 365 + random.randint(0, 364))
        data_urodzenia = birth_date_dt.strftime("%d.%m.%Y")

        # Generate PESEL based on new data
        pesel = generate_pesel(data_urodzenia, plec)

        # Rule 5 & 9: Generate random document numbers
        def generate_doc_series():
            return "".join(random.choices(string.ascii_uppercase, k=3)) + "".join(
                random.choices(string.digits, k=6)
            )

        seria_numer_mdowodu = generate_doc_series()
        seria_numer_dowodu = generate_doc_series()

        # Rule 6, 7, 10: Issue and Expiry Dates
        data_wydania_dt = today - timedelta(
            days=random.randint(1, 365 * 5) # Issued within the last 5 years
        )
        termin_waznosci_dt = data_wydania_dt + timedelta(
            days=10 * 365 # Valid for 10 years
        )

        data_wydania_mdowodu = data_wydania_dt.strftime("%Y-%m-%d")
        termin_waznosci_mdowodu = termin_waznosci_dt.strftime("%Y-%m-%d")

        # Slightly different dates for the other document for realism
        data_wydania_dowodu_dt = today - timedelta(days=random.randint(1, 365 * 5))
        termin_waznosci_dowodu_dt = data_wydania_dowodu_dt + timedelta(days=10 * 365)
        data_wydania_dowodu = data_wydania_dowodu_dt.strftime("%Y-%m-%d")
        termin_waznosci_dowodu = termin_waznosci_dowodu_dt.strftime("%Y-%m-%d")

        # Rule 15 & 16: Address and registration date
        adres_zameldowania = f"{random.choice(warsaw_streets)} {random.randint(1, 150)}, {random.choice(warsaw_postal_codes)} Warszawa"

        registration_start_date = birth_date_dt
        registration_end_date = today
        registration_time_between = registration_end_date - registration_start_date
        days_between = registration_time_between.days
        random_number_of_days = random.randrange(days_between)
        data_zameldowania_dt = registration_start_date + timedelta(
            days=random_number_of_days
        )
        data_zameldowania = data_zameldowania_dt.strftime("%Y-%m-%d")

        # Generate mPrawo Jazdy random data
        pj_categories = random.choice(["B", "B, B1", "A, B", "A, B, C", "B, C, D", "A, B, B1"])
        pj_data_wydania_dt = today - timedelta(days=random.randint(30, 365 * 8))
        pj_data_wydania = pj_data_wydania_dt.strftime("%Y-%m-%d")
        pj_numer = f"{random.randint(10000, 99999)}/{pj_data_wydania_dt.strftime('%y')}/{random.randint(1, 9999):04d}"
        pj_blankiet = f"{random.choice(string.ascii_uppercase)}{random.choice(string.ascii_uppercase)} {random.randint(1000000, 9999999)}"
        pj_organs = [
            "PREZYDENT M.ST. WARSZAWY",
            "STAROSTA PIASECZYŃSKI",
            "STAROSTA PRUSZKOWSKI",
            "STAROSTA WOŁOMIŃSKI",
            "PREZYDENT M. KRAKOWA",
            "PREZYDENT M. WROCŁAWIA",
            "STAROSTA GRODZISKI",
            "PREZYDENT M. GDAŃSKA",
        ]
        pj_organ = random.choice(pj_organs)
        pj_ograniczenia = random.choice(["", "01.06", "01.01", "01.06, 02.01", ""])

        # Legitymacja szkolna random data
        si_numer = f"{random.randint(100, 999)}/{random.randint(1, 30)}"
        si_data_wydania_dt = today - timedelta(days=random.randint(30, 365))
        si_data_wydania = si_data_wydania_dt.strftime("%d.%m.%Y")
        si_data_waznosci_dt = si_data_wydania_dt + timedelta(days=365)
        si_data_waznosci = si_data_waznosci_dt.strftime("%d.%m.%Y")
        si_szkoly = [
            "I Liceum Ogólnokształcące im. Adama Mickiewicza",
            "II Liceum Ogólnokształcące im. Stefana Batorego",
            "XIV Liceum Ogólnokształcące im. Stanisława Staszica",
            "XXXIII Liceum Ogólnokształcące Dwujęzyczne im. Mikołaja Kopernika",
            "Technikum Mechatroniczne nr 1",
            "Technikum Informatyczne nr 7",
            "Zespół Szkół Licealnych i Technicznych nr 1",
        ]
        si_nazwa_szkoly = random.choice(si_szkoly)
        si_adres = f"ul. {random.choice(warsaw_streets)} {random.randint(1, 80)}, {random.choice(warsaw_postal_codes)} Warszawa"
        si_dyrektor_imie = random.choice(male_first_names if random.random() > 0.5 else female_first_names)
        si_dyrektor_nazwisko = random.choice(last_names)
        si_dyrektor = f"{si_dyrektor_imie} {si_dyrektor_nazwisko}"
        si_telefon = f"22 {random.randint(100, 999)} {random.randint(10, 99)} {random.randint(10, 99)}"

        # Legitymacja studencka random data
        sti_data_wydania_dt = today - timedelta(days=random.randint(30, 365))
        sti_data_wydania = sti_data_wydania_dt.strftime("%d.%m.%Y")
        sti_uczelnie = [
            "Politechnika Warszawska",
            "Uniwersytet Warszawski",
            "Szkoła Główna Handlowa w Warszawie",
            "Uniwersytet Jagielloński",
            "Politechnika Wrocławska",
            "Uniwersytet im. Adama Mickiewicza w Poznaniu",
            "Politechnika Gdańska",
            "Akademia Górniczo-Hutnicza w Krakowie",
        ]
        sti_uczelnia = random.choice(sti_uczelnie)

        # Assemble the data dictionary
        random_data = {
            "imie": imie,
            "nazwisko": nazwisko,
            "obywatelstwo": "Polskie",  # Rule 2
            "data_urodzenia": data_urodzenia,
            "pesel": pesel,
            "plec": "M" if plec == "Mężczyzna" else "K",
            "seria_numer_mdowodu": seria_numer_mdowodu,
            "termin_waznosci_mdowodu": termin_waznosci_mdowodu,
            "data_wydania_mdowodu": data_wydania_mdowodu,
            "imie_ojca_mdowod": imie_ojca_mdowod,
            "imie_matki_mdowod": imie_matki_mdowod,
            "seria_numer_dowodu": seria_numer_dowodu,
            "termin_waznosci_dowodu": termin_waznosci_dowodu,
            "data_wydania_dowodu": data_wydania_dowodu,
            "nazwisko_rodowe": nazwisko_normal_case,  # Rule 11 - normal case
            "nazwisko_rodowe_ojca": nazwisko_normal_case,  # Rule 12 - normal case
            "nazwisko_rodowe_matki": nazwisko_rodowe_matki,  # Rule 13 - normal case
            "miejsce_urodzenia": "Warszawa",  # Rule 14
            "adres_zameldowania": adres_zameldowania,  # Rule 15
            "data_zameldowania": data_zameldowania,  # Rule 16
            # mPrawo Jazdy fields
            "pj_kategorie": pj_categories,
            "pj_data_wydania": pj_data_wydania,
            "pj_numer": pj_numer,
            "pj_blankiet": pj_blankiet,
            "pj_organ": pj_organ,
            "pj_ograniczenia": pj_ograniczenia,
            # Legitymacja szkolna fields
            "si_numer": si_numer,
            "si_data_wydania": si_data_wydania,
            "si_data_waznosci": si_data_waznosci,
            "si_nazwa_szkoly": si_nazwa_szkoly,
            "si_adres": si_adres,
            "si_dyrektor": si_dyrektor,
            "si_telefon": si_telefon,
            # Legitymacja studencka fields
            "sti_data_wydania": sti_data_wydania,
            "sti_uczelnia": sti_uczelnia,
        }

        return jsonify(random_data)

    except Exception as e:
        logging.error(f"Error generating random data: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas generowania danych"}
        ), 500


@app.route("/", methods=["GET", "POST"])
def index():
    # In load test mode, bypass all authentication checks
    if not is_load_test_mode and not current_user.is_authenticated:
        return redirect(url_for("login"))

    if current_user.is_authenticated:
        log_user_action("Visited main page.")

    if request.method == "POST":
        # The authentication check for POST is now handled by the initial check,
        # so we can proceed directly to the form processing.
        log_user_action("Submitted the main form to modify/create a document.")
        try:
            # Get user name from form
            user_name = request.form.get("user_name")

            if not user_name:
                return jsonify(
                    {"success": False, "error": "Nazwa użytkownika jest wymagana"}
                )
            user_name = user_name.strip()
            if current_user.is_authenticated and user_name != current_user.username:
                logging.warning(
                    f"User '{current_user.username}' attempted to submit form for '{user_name}'."
                )
                return jsonify(
                    {
                        "success": False,
                        "error": "Brak uprawnień do modyfikacji danych innego użytkownika.",
                    }
                ), 403

            # Create user folders if they don't exist
            try:
                user_folder, files_folder, logs_folder = create_user_folder(user_name)
            except ValueError:
                return jsonify(
                    {"success": False, "error": "Nieprawidłowa nazwa użytkownika"}
                ), 400

            template_version = request.form.get("template_version", "new_mdowod")
            use_new = template_version == "new_mdowod"
            use_pj = template_version == "new_mprawojazdy"
            use_si = template_version == "new_school_id"
            use_sti = template_version == "new_student_id"

            if use_si:
                output_filename = "school_id_new.html"
                base_template = FIXED_INPUT_FILE_SI
            elif use_sti:
                output_filename = "student_id_new.html"
                base_template = FIXED_INPUT_FILE_STI
            elif use_pj:
                output_filename = "prawojazdy_new.html"
                base_template = FIXED_INPUT_FILE_PJ
            elif use_new:
                output_filename = "dowodnowy_new.html"
                base_template = FIXED_INPUT_FILE_NEW
            else:
                output_filename = "dowodnowy.html"
                base_template = FIXED_INPUT_FILE

            output_filepath = os.path.join(files_folder, output_filename)

            # Always use the clean base template so re-submissions fully overwrite
            input_filepath = os.path.join(os.getcwd(), base_template)

            try:
                with open(input_filepath, "r", encoding="utf-8") as f:
                    soup = BeautifulSoup(f, "html.parser")
            except FileNotFoundError:
                logging.error(f"Input file {input_filepath} not found.")
                return jsonify(
                    {
                        "success": False,
                        "error": f"Plik wejściowy {input_filepath} nie został znaleziony.",
                    }
                )

            # Collect data from form
            new_data = {
                "imie": request.form.get("imie"),
                "nazwisko": request.form.get("nazwisko"),
                "obywatelstwo": request.form.get("obywatelstwo"),
                "data_urodzenia": request.form.get("data_urodzenia"),
                "pesel": request.form.get("pesel"),
                "seria_numer_mdowodu": request.form.get("seria_numer_mdowodu"),
                "termin_waznosci_mdowodu": request.form.get("termin_waznosci_mdowodu"),
                "data_wydania_mdowodu": request.form.get("data_wydania_mdowodu"),
                "imie_ojca_mdowod": request.form.get("imie_ojca_mdowod"),
                "imie_matki_mdowod": request.form.get("imie_matki_mdowod"),
                "seria_numer_dowodu": request.form.get("seria_numer_dowodu"),
                "termin_waznosci_dowodu": request.form.get("termin_waznosci_dowodu"),
                "data_wydania_dowodu": request.form.get("data_wydania_dowodu"),
                "nazwisko_rodowe": request.form.get("nazwisko_rodowe"),
                "plec": request.form.get("plec"),
                "nazwisko_rodowe_ojca": request.form.get("nazwisko_rodowe_ojca"),
                "nazwisko_rodowe_matki": request.form.get("nazwisko_rodowe_matki"),
                "miejsce_urodzenia": request.form.get("miejsce_urodzenia"),
                "adres_zameldowania": request.form.get("adres_zameldowania"),
                "data_zameldowania": request.form.get("data_zameldowania"),
                # mPrawo Jazdy fields
                "pj_kategorie": request.form.get("pj_kategorie"),
                "pj_data_wydania": request.form.get("pj_data_wydania"),
                "pj_numer": request.form.get("pj_numer"),
                "pj_blankiet": request.form.get("pj_blankiet"),
                "pj_organ": request.form.get("pj_organ"),
                "pj_ograniczenia": request.form.get("pj_ograniczenia"),
                # Legitymacja szkolna fields
                "si_numer": request.form.get("si_numer"),
                "si_data_wydania": request.form.get("si_data_wydania"),
                "si_data_waznosci": request.form.get("si_data_waznosci"),
                "si_nazwa_szkoly": request.form.get("si_nazwa_szkoly"),
                "si_adres": request.form.get("si_adres"),
                "si_dyrektor": request.form.get("si_dyrektor"),
                "si_telefon": request.form.get("si_telefon"),
                # Legitymacja studencka fields
                "sti_data_wydania": request.form.get("sti_data_wydania"),
                "sti_uczelnia": request.form.get("sti_uczelnia"),
                "template_version": template_version,
            }
            app.logger.info(f"Form data received: {new_data}")

            # Handle image upload
            image_file = request.files.get("image_upload")
            image_saved = False
            new_image_hash = None  # Initialize to None
            image_filename = "zdjecie_686510da4d2591.91511191.jpg"
            image_filepath = os.path.join(
                files_folder, image_filename
            )  # Initialize here

            # Initialize image_filename in new_data based on whether the file exists on disk
            if os.path.exists(image_filepath):
                new_data["image_filename"] = image_filename
            else:
                new_data["image_filename"] = None  # Default to None if no image exists

            if image_file and image_file.filename != "":
                log_user_action(f"Uploaded a new image: {image_file.filename}")

                # Security check: Prevent path traversal in uploaded filename
                filename = image_file.filename or ""
                if (
                    ".." in filename
                    or "/" in filename
                    or "\\" in filename
                ):
                    return jsonify(
                        {
                            "success": False,
                            "error": "Nazwa pliku zawiera niedozwolone znaki (np. ścieżki).",
                        }
                    ), 400

                # Validate file type and size
                allowed_extensions = {"png", "jpg", "jpeg", "gif"}
                max_file_size = int(
                    app.config.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
                )

                file_extension = (
                    filename.rsplit(".", 1)[1].lower()
                    if "." in filename
                    else ""
                )
                if file_extension not in allowed_extensions:
                    return jsonify(
                        {
                            "success": False,
                            "error": "Nieprawidłowy format pliku obrazu. Dozwolone: png, jpg, jpeg, gif.",
                        }
                    )

                image_file.seek(0, os.SEEK_END)
                file_size = image_file.tell()
                image_file.seek(0)

                if file_size > max_file_size:
                    return jsonify(
                        {
                            "success": False,
                            "error": f"Rozmiar pliku przekracza dozwolony limit {max_file_size / (1024 * 1024):.0f}MB.",
                        }
                    )

                new_image_hash = hashlib.sha256(image_file.read()).hexdigest()
                image_file.seek(0)

                old_image_hash = calculate_file_hash(image_filepath)

                if new_image_hash != old_image_hash:
                    image_file.save(image_filepath)
                    image_saved = True  # <-- FIX: Set the flag to true after saving
                    log_user_action("Image file was new and has been saved.")
                    new_data["image_filename"] = (
                        image_filename  # Ensure it's set after successful save
                    )
                else:
                    log_user_action(
                        "Uploaded image was identical to the existing one; not saved."
                    )
                    # Ustawiamy flagę, że obraz nie został zapisany, aby nie aktualizować metadanych w DB
                    image_saved = False
            else:
                # If no image file is uploaded, and no existing file, new_data['image_filename'] will be None
                pass

            # Save last submitted data for pre-filling
            last_data_filepath = os.path.join(logs_folder, "last_form_data.json")
            with open(last_data_filepath, "w", encoding="utf-8") as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)

            # Log the submission to a dedicated file for the user
            submission_log_path = os.path.join(logs_folder, "form_submissions.log")
            submission_record = {
                "timestamp": datetime.now().isoformat(),
                "ip_address": request.remote_addr,
                "user_agent": request.headers.get("User-Agent"),
                "form_data": new_data,
            }
            with open(submission_log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(submission_record) + "\n")

            if use_si:
                modified_soup = replace_html_data_school_id(soup, new_data)
            elif use_sti:
                modified_soup = replace_html_data_student_id(soup, new_data)
            elif use_pj:
                modified_soup = replace_html_data_mprawojazdy(soup, new_data)
            elif use_new:
                modified_soup = replace_html_data_new(soup, new_data)
            else:
                modified_soup = replace_html_data(soup, new_data)

            # Update the image source in the HTML (must happen before serialization)
            img_tag = modified_soup.find("img", id="user_photo")
            if img_tag and new_data.get("image_filename"):
                img_tag["src"] = url_for(
                    "serve_user_file",
                    username=user_name,
                    filename=new_data["image_filename"],
                )

            # Check if HTML content has changed
            html_content_changed = False
            new_html_content = str(modified_soup)
            if os.path.exists(output_filepath):
                with open(output_filepath, "r", encoding="utf-8") as f:
                    old_html_content = f.read()
                if old_html_content != new_html_content:
                    html_content_changed = True
            else:
                html_content_changed = True

            if html_content_changed:
                with open(output_filepath, "w", encoding="utf-8") as f:
                    f.write(new_html_content)
                log_user_action("HTML document file was modified.")

            # --- DB Integration for file metadata ---
            try:
                # Add/update HTML file metadata
                html_file_hash = calculate_file_hash(output_filepath) or ""
                statistics_service.add_or_update_file(
                    username=user_name,
                    filename=output_filename,
                    filepath=output_filepath,
                    size=len(new_html_content.encode("utf-8")),
                    file_hash=html_file_hash,
                )
                # Add/update image file metadata if it was saved
                if image_saved and new_image_hash:
                    statistics_service.add_or_update_file(
                        username=user_name,
                        filename=image_filename,
                        filepath=image_filepath,
                        size=os.path.getsize(image_filepath),
                        file_hash=new_image_hash,
                    )
                db.session.commit()
                
            except Exception as db_error:
                db.session.rollback()
                logging.error(
                    f"Database error during file metadata update: {db_error}",
                    exc_info=True,
                )
                # Optionally, decide if you should delete the saved files if DB operation fails
                return jsonify(
                    {
                        "success": False,
                        "error": "Błąd zapisu metadanych pliku do bazy danych.",
                    }
                ), 500

            # Instead of sending the file, return a success message
            return jsonify(
                {
                    "success": True,
                    "message": "Dane i pliki zostały przetworzone pomyślnie.",
                }
            )

        except Exception as e:
            if isinstance(e, RequestEntityTooLarge):
                return jsonify(
                    {
                        "success": False,
                        "error": "Przesłany plik przekracza dozwolony rozmiar.",
                    }
                ), 413
            logging.error(
                f"Error in index POST request: {e}", exc_info=True
            )  # Log full traceback
            return jsonify(
                {
                    "success": False,
                    "error": "Wystąpił błąd podczas przetwarzania danych.",
                }
            )

    # Sprawdź czy użytkownik jest zalogowany
    last_form_data = {}

    if current_user.is_authenticated:
        user_name = current_user.username
        try:
            user_folder, files_folder, logs_folder = create_user_folder(
                user_name
            )  # Ensure folders exist
        except ValueError:
            logout_user()
            return redirect(
                url_for(
                    "login",
                    message="Nieprawidłowa nazwa użytkownika. Zaloguj się ponownie.",
                )
            )

        last_data_filepath = os.path.join(logs_folder, "last_form_data.json")
        if os.path.exists(last_data_filepath):
            try:
                with open(last_data_filepath, "r", encoding="utf-8") as f:
                    last_form_data = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                last_form_data = {}

    # Fetch user statistics from DB
    all_users = auth_manager.get_all_users()
    total_registered_users = len(all_users)
    active_users = [user for user in all_users if user.is_active]
    num_active_users = len(active_users)

    top_user = None
    if all_users:
        top_user = max(all_users, key=lambda user: user.hubert_coins, default=None)

    # Fetch active announcements
    announcements = announcement_service.get_active_announcements()

    # Fetch tutorial status
    has_seen_tutorial = current_user.has_seen_tutorial if current_user.is_authenticated else True

    return render_template(
        "index.html",
        user_logged_in=current_user.is_authenticated,
        username=current_user.username if current_user.is_authenticated else None,
        total_registered_users=total_registered_users,
        num_active_users=num_active_users,
        top_user=top_user,
        last_form_data=last_form_data,
        announcements=announcements,
        has_seen_tutorial=has_seen_tutorial,
        is_impersonating=session.get("is_impersonating", False),
        original_admin_id=session.get("original_admin_id"),
        csrf_token_func=generate_csrf,
        template_version=last_form_data.get("template_version", "new"),
    )


@app.route("/api/log-action", methods=["POST"])
@login_required
def log_action():
    """API endpoint to log user actions from the frontend."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "Nieprawidłowy format danych"}), 400
    action_raw = data.get("action")
    if not isinstance(action_raw, str):
        return jsonify({"success": False, "error": "No action provided"}), 400

    action = _sanitize_log_action(action_raw)
    if action:
        log_user_action(action)
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No action provided"}), 400


@app.route("/api/complete-tutorial", methods=["POST"])
@login_required
def complete_tutorial():
    """API endpoint to mark the tutorial as completed for the current user."""
    try:
        current_user.has_seen_tutorial = True
        db.session.commit()
        log_user_action("Completed the tutorial.")
        return jsonify({"success": True, "message": "Tutorial marked as completed."})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error marking tutorial as completed for {current_user.username}: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Wystąpił błąd podczas zapisywania statusu samouczka."}), 500


@app.route("/admin/")
@require_admin_login
def admin():
    log_user_action("Visited admin panel.")
    return render_template("admin_enhanced.html")


@app.route("/admin/login", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])  # Prevent brute force on admin login
def admin_login():
    if request.method == "POST":
        try:
            data = request.get_json()
            app.logger.debug(
                f"Raw admin login POST request data: {data}"
            )  # Added for debugging
            app.logger.debug(
                f"Admin login POST request data: {_filter_sensitive_data(data)}"
            )  # Log request data

            # Ensure username and password are strings to prevent AttributeError
            username = str(data.get("username", "")).strip() if data else ""
            password = str(data.get("password", "")).strip() if data else ""
            
            # Basic validation
            if not username or not password:
                return jsonify({"success": False, "error": "Wszystkie pola są wymagane"}), 400
            
            # Check for null bytes or control characters
            if '\x00' in username or '\x00' in password:
                logging.warning(f"Admin login attempt with null bytes from username: {username}")
                return jsonify({"success": False, "error": "Nieprawidłowe znaki w danych logowania"}), 400

            # Compare directly with environment variables using timing-safe comparison
            admin_user_env = os.environ.get("ADMIN_USERNAME")
            admin_pass_env = os.environ.get("ADMIN_PASSWORD")

            # Use hmac.compare_digest to prevent timing attacks
            username_match = hmac.compare_digest(username, admin_user_env or "")
            password_match = hmac.compare_digest(password, admin_pass_env or "")

            if username_match and password_match:
                _regenerate_server_session()
                session["admin_logged_in"] = True
                session["admin_username"] = username
                logging.info(f"Admin login successful for user: {username}")
                response_json = {"success": True, "message": "Logowanie pomyślne"}
                app.logger.debug(
                    f"Admin login POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json)
            else:
                logging.warning(f"Failed admin login attempt for user: {username}")
                response_json = {
                    "success": False,
                    "error": "Nieprawidłowe dane logowania",
                }
                app.logger.debug(
                    f"Admin login POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json), 401
        except Exception as e:
            logging.error(f"Error in admin login: {e}", exc_info=True)
            response_json = {
                "success": False,
                "error": "Wystąpił błąd podczas logowania",
            }
            app.logger.debug(
                f"Admin login POST response: {response_json}"
            )  # Log response data
            return jsonify(response_json), 500

    return render_template("admin_login.html", csrf_token_func=generate_csrf)


@app.route("/admin/logout")
@require_admin_login
def admin_logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_username", None)
    return redirect(url_for("admin_login"))


@app.route("/admin/api/users")
@require_admin_login
@cached_if_not_testing(timeout=60)
def api_get_users():
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        paginated_data = statistics_service.get_all_users_with_stats(
            page=page, per_page=per_page
        )
        stats = statistics_service.get_overall_stats()
        return jsonify({"success": True, "users_data": paginated_data, "stats": stats})
    except Exception as e:
        logging.error(f"Error getting users from DB: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas pobierania danych użytkowników",
            }
        ), 500


@app.route("/admin/api/stats", methods=["GET"])
@require_admin_login
def api_get_admin_stats():
    """Lightweight stats endpoint used by admin panel health checks."""
    try:
        overall_stats = statistics_service.get_overall_stats()
        total_registered_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()

        return jsonify(
            {
                "success": True,
                "stats": {
                    "total_users": overall_stats.get("total_users", total_registered_users),
                    "active_users": active_users,
                    "total_files": overall_stats.get("total_files", 0),
                    "total_size": overall_stats.get("total_size", 0),
                },
            }
        )
    except Exception as e:
        logging.error(f"Error getting admin stats: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas pobierania statystyk."}
        ), 500


@app.route("/admin/api/announcements", methods=["POST"])
@require_admin_login
def api_create_announcement():
    """API endpoint for admin to create a new announcement."""
    try:
        data = request.get_json()
        title = data.get("title")
        message = data.get("message")
        announcement_type = data.get("type", "info")
        expires_at_str = data.get("expires_at")
        expires_at = None
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            except ValueError:
                return jsonify(
                    {"success": False, "error": "Nieprawidłowy format daty wygaśnięcia."} 
                ), 400

        if not title or not message:
            return jsonify(
                {"success": False, "error": "Tytuł i treść ogłoszenia są wymagane."} 
            ), 400

        if expires_at == "":
            expires_at = None

        announcement_service.create_announcement(
            title, message, announcement_type, expires_at
        )
        db.session.commit()
        return jsonify(
            {"success": True, "message": "Ogłoszenie zostało pomyślnie dodane."} 
        )
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating announcement: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "Wystąpił wewnętrzny błąd serwera."} 
        ), 500


def is_valid_username(username: str) -> bool:
    """
    Sprawdza czy nazwa użytkownika jest bezpieczna i nie zawiera niedozwolonych znaków.
    
    Niedozwolone znaki:
    - Windows: < > : " / \\ | ? * oraz znaki kontrolne (0-31)
    - Unix: / oraz znaki kontrolne
    - Null byte: \\x00
    
    Args:
        username: The username to validate.
        
    Returns:
        True if the username is valid, False otherwise.
    """
    if not username or len(username) == 0:
        return False
    
    # Sprawdź null byte
    if '\x00' in username:
        return False
    
    # Niedozwolone znaki w nazwach plików (Windows + Unix)
    forbidden_chars = set('<>:"/\\|?*')
    if any(char in forbidden_chars for char in username):
        return False
    
    # Sprawdź znaki kontrolne (0-31)
    if any(ord(char) < 32 for char in username):
        return False
    
    # Sprawdź czy nazwa nie zaczyna się od . (ukryty plik) lub zawiera ..
    if username.startswith('.') or '..' in username:
        return False
    
    return True


def is_safe_path(basedir: str, path: str, follow_symlinks: bool = True) -> bool:
    """Check if a path is safe and within the base directory.
    
    Args:
        basedir: The base directory that path should be within.
        path: The path to check.
        follow_symlinks: Whether to resolve symbolic links.
        
    Returns:
        True if path is safely within basedir, False otherwise.
    """
    # Sprawdź czy ścieżka zawiera null byte (atak)
    if '\x00' in path:
        return False
    
    # Rozwiązuje symboliczne linki
    try:
        if follow_symlinks:
            matchpath = os.path.realpath(path)
        else:
            matchpath = os.path.abspath(path)
        return basedir == os.path.commonpath((basedir, matchpath))
    except (ValueError, OSError):
        # ValueError: embedded null character in path (Windows)
        # OSError: inne problemy z ścieżką
        return False


def validate_username_path(f):
    """
    Dekorator do walidacji nazwy użytkownika i ścieżki.
    Zapobiega atakom Path Traversal i waliduje nazwę użytkownika.
    Wymaga parametru 'username' w URL endpointu.
    """
    @wraps(f)
    def decorated_function(username, *args, **kwargs):
        # Walidacja nazwy użytkownika
        if not is_valid_username(username):
            logging.warning(f"Nieprawidlowa nazwa uzytkownika: {username}")
            return jsonify(
                {"success": False, "error": "Nieprawidlowa nazwa uzytkownika"}
            ), 400
        
        # Sprawdzenie Path Traversal
        if not is_safe_path(
            os.path.abspath(USER_DATA_DIR),
            os.path.abspath(os.path.join(USER_DATA_DIR, username)),
        ):
            logging.warning(
                f"Potencjalna proba ataku Path Traversal na uzytkownika: {username}"
            )
            return jsonify(
                {"success": False, "error": "Nieprawidlowa nazwa uzytkownika"}
            ), 400
        
        return f(username, *args, **kwargs)
    return decorated_function


@app.route("/admin/api/user-logs/<username>")
@require_admin_login
@validate_username_path
def api_get_user_logs(username):
    try:
        user_folder, _, logs_folder = create_user_folder(username)

        logs = []
        submissions = []

        # Odczytaj logi aktywności
        actions_log_path = os.path.join(logs_folder, "actions.log")
        if os.path.exists(actions_log_path):
            try:
                with open(actions_log_path, "r", encoding="utf-8") as f:
                    logs = [line.strip() for line in f.readlines()]
            except Exception as e:
                logging.error(f"Error reading actions.log for {username}: {e}")

        # Odczytaj dane formularzy z nowego pliku logów
        submissions_log_path = os.path.join(logs_folder, "form_submissions.log")
        if os.path.exists(submissions_log_path):
            try:
                with open(submissions_log_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            submissions.append(json.loads(line))
                # Sort submissions by timestamp, newest first
                submissions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            except (json.JSONDecodeError, FileNotFoundError) as e:
                logging.error(
                    f"Error reading or parsing form_submissions.log for {username}: {e}"
                )

        # Pobierz listę plików z bazy danych
        files_obj = statistics_service.get_user_files(username)
        files = [
            {
                "name": f.filename,
                "path": f.filepath,
                "size": f.size,
                "modified": f.modified_at,
            }
            for f in files_obj
        ]

        return jsonify(
            {"success": True, "logs": logs, "submissions": submissions, "files": files}
        )
    except Exception as e:
        logging.error(f"Error getting user logs for {username}: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "error": f"Wystapil blad podczas pobierania logow uzytkownika {username}",
            }
        ), 500


@app.route("/admin/api/download-user/<username>")
@require_admin_login
@validate_username_path
def api_download_user_data(username):
    try:
        # Create temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, f"{username}_data.zip")
        
        # Register cleanup for temp directory
        @atexit.register
        def cleanup_temp():
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)

        user_folder = os.path.join(USER_DATA_DIR, username)
        if not os.path.exists(user_folder):
            shutil.rmtree(temp_dir, ignore_errors=True)
            return jsonify({"error": "Użytkownik nie istnieje"}), 404

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(user_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, user_folder)
                    zipf.write(file_path, arcname)

        # Send file and schedule cleanup after response
        response = send_file(
            zip_path, as_attachment=True, download_name=f"{username}_data.zip"
        )
        
        @response.call_on_close
        def cleanup_after_send():
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        return response
    except Exception as e:
        logging.error(f"Error downloading user data for {username}: {e}")
        return jsonify(
            {"error": f"Wystąpił błąd podczas pobierania danych użytkownika {username}"}
        ), 500


@app.route("/admin/api/delete-registered-user/<username>", methods=["DELETE"])
@require_admin_login
@validate_username_path
def api_delete_registered_user(username):
    app.logger.info(
        f"Attempting to delete user '{username}'. Full request: {request.url}"
    )

    delete_files = request.args.get("delete_files", "false").lower() == "true"
    app.logger.info(f"Parameter 'delete_files' is set to: {delete_files}")

    try:
        app.logger.info(f"Calling auth_manager.delete_user for '{username}'.")
        user_deleted = auth_manager.delete_user(username)
        app.logger.info(f"auth_manager.delete_user returned: {user_deleted}")

        if not user_deleted:
            app.logger.warning(f"User '{username}' not found in database for deletion.")
            return jsonify({"success": False, "error": "Użytkownik nie istnieje"}), 404

        message = f"Użytkownik {username} został usunięty."

        # Conditionally delete the physical user data folder
        if delete_files:
            app.logger.info(
                f"'delete_files' is True. Proceeding to delete data folder for '{username}'."
            )
            # CORRECTED: Use absolute path to ensure correct directory removal
            user_folder = os.path.join(app.root_path, USER_DATA_DIR, username)
            if os.path.exists(user_folder):
                app.logger.info(f"User data folder found at {user_folder}. Deleting...")
                shutil.rmtree(user_folder)
                logging.info(f"Admin deleted user: {username} and their data folder.")
                message += " Jego pliki również zostały usunięte."
            else:
                app.logger.warning(
                    f"User data folder for '{username}' not found, but user was deleted from DB."
                )
                logging.info(
                    f"Admin deleted user: {username}. Data folder did not exist."
                )
        else:
            app.logger.info(
                f"'delete_files' is False. Preserving data folder for '{username}'."
            )
            logging.info(f"Admin deleted user: {username}. Their files were preserved.")
            message += " Jego pliki zostały zachowane."

        app.logger.info(
            f"Successfully processed deletion for '{username}'. Sending success response."
        )
        
        return jsonify({"success": True, "message": message})

    except Exception as e:
        logging.error(
            f"Critical error during user deletion for {username}: {e}", exc_info=True
        )
        return jsonify(
            {
                "success": False,
                "error": f"Wystąpił błąd podczas usuwania użytkownika {username}",
            }
        ), 500


@app.route("/admin/api/delete-user-files/<username>", methods=["DELETE"])
@require_admin_login
@validate_username_path
def api_delete_user_files(username):
    try:
        user_folder = os.path.join(USER_DATA_DIR, username)
        files_folder = os.path.join(user_folder, "files")

        if os.path.exists(files_folder):
            # Get list of files to delete from DB first
            files_in_db = statistics_service.get_user_files(username)
            for file_meta in files_in_db:
                statistics_service.delete_file(file_meta.filepath)

            # CRITICAL FIX: Commit the session to permanently delete file records from DB
            db.session.commit()

            # Delete physical folder
            shutil.rmtree(user_folder)  # Deletes the entire user folder including logs
            logging.info(f"Admin deleted all data for user: {username}")
            invalidate_users_cache()
            return jsonify(
                {
                    "success": True,
                    "message": f"Wszystkie dane użytkownika {username} zostały usunięte",
                }
            )
        else:
            return jsonify(
                {"success": False, "error": "Katalog użytkownika nie istnieje"}
            ), 404
    except Exception as e:
        logging.error(f"Error deleting user files for {username}: {e}")
        return jsonify(
            {
                "success": False,
                "error": f"Wystąpił błąd podczas usuwania plików użytkownika {username}",
            }
        ), 500


@app.route("/admin/api/backup/full", methods=["GET"])
@require_admin_login
def api_full_backup():
    """API endpoint for admin to download a full backup of user_data."""
    temp_dir = None  # Initialize to avoid unbound error
    try:
        # Create a temporary directory for the zip file
        temp_dir = tempfile.mkdtemp()
        zip_filename = (
            f"full_user_data_backup_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        )
        zip_path = os.path.join(temp_dir, zip_filename)

        user_data_root = os.path.abspath(USER_DATA_DIR)
        auth_data_root = os.path.abspath(AUTH_DATA_DIR)

        if not os.path.exists(user_data_root) and not os.path.exists(auth_data_root):
            return jsonify(
                {
                    "success": False,
                    "error": "Katalogi user_data i auth_data nie istnieją.",
                }
            ), 404

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            if os.path.exists(user_data_root):
                for root, dirs, files in os.walk(user_data_root):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(
                            file_path, os.path.dirname(user_data_root)
                        )
                        zipf.write(file_path, arcname)
            if os.path.exists(auth_data_root):
                for root, dirs, files in os.walk(auth_data_root):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.join(
                            "auth_data", os.path.relpath(file_path, auth_data_root)
                        )
                        zipf.write(file_path, arcname)

        logging.info(f"Admin downloaded full backup: {zip_filename}")
        
        # Send file and schedule cleanup after response
        response = send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype="application/zip",
        )
        
        @response.call_on_close
        def cleanup_after_send():
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        return response
    except Exception as e:
        # Clean up on error
        try:
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        except NameError:
            pass  # temp_dir was not defined yet
        logging.error(f"Error creating full backup: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas tworzenia kopii zapasowej.",
            }
        ), 500


# API endpoints for access key management
@app.route("/admin/api/access-keys", methods=["GET"])
@require_admin_login
def api_get_access_keys():
    try:
        try:
            keys = access_key_service.get_all_access_keys()
        except OperationalError as db_error:
            # Self-heal if database schema is missing after restore/import.
            if "no such table" not in str(db_error).lower():
                raise

            logging.warning(
                "Missing database table detected while fetching access keys; attempting db.create_all() recovery.",
                exc_info=True,
            )
            db.session.rollback()
            db.create_all()
            keys = access_key_service.get_all_access_keys()

        # Convert objects to dictionaries for JSON serialization
        keys_list = [
            {
                "key": key.key,
                "description": key.description,
                "created_at": key.created_at,
                "expires_at": key.expires_at,
                "is_active": key.is_active,
                "used_count": key.used_count,
                "last_used": key.last_used,
            }
            for key in keys
        ]
        return jsonify({"success": True, "access_keys": keys_list})
    except Exception as e:
        logging.error(f"Error getting access keys: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas pobierania kluczy dostępu"}
        ), 500


@app.route("/admin/api/generate-access-key", methods=["POST"])
@require_admin_login
def api_generate_access_key():
    try:
        data = request.get_json()
        description = data.get("description")
        validity_days = data.get("validity_days")

        key = access_key_service.generate_access_key(description, validity_days)
        db.session.commit()

        return jsonify({"success": True, "access_key": key})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error generating access key: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas generowania klucza dostępu",
            }
        )


@app.route("/admin/api/deactivate-access-key", methods=["POST"])
@require_admin_login
def api_deactivate_access_key():
    try:
        data = request.get_json()
        key = data.get("access_key")

        success = access_key_service.deactivate_access_key(key)
        if success:
            db.session.commit()
    
            return jsonify(
                {"success": True, "message": "Klucz dostępu dezaktywowany pomyślnie"}
            )
        else:
            return jsonify(
                {
                    "success": False,
                    "error": "Klucz dostępu nie został znaleziony lub jest już nieaktywny",
                }
            )
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deactivating access key: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas dezaktywacji klucza dostępu",
            }
        )


@app.route("/admin/api/delete-access-key", methods=["DELETE"])
@require_admin_login
def api_delete_access_key():
    try:
        data = request.get_json()
        key = data.get("access_key")

        success = access_key_service.delete_access_key(key)
        if success:
            db.session.commit()
    
            return jsonify(
                {"success": True, "message": "Klucz dostępu usunięty pomyślnie"}
            )
        else:
            return jsonify(
                {"success": False, "error": "Klucz dostępu nie został znaleziony"}
            )
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting access key: {e}")
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas usuwania klucza dostępu"}
        )


# API endpoints for registered users management
@app.route("/admin/api/registered-users", methods=["GET"])
@require_admin_login
def api_get_registered_users():
    try:
        users = auth_manager.get_all_users(include_passwords=True)
        # Convert objects to a list of dictionaries
        users_list = [
            {
                "username": user.username,
                "created_at": user.created_at,
                "is_active": user.is_active,
                "last_login": user.last_login,
                "access_key_used": user.access_key_used,
                "hubert_coins": user.hubert_coins,
                # Exclude password for security
            }
            for user in users
        ]
        return jsonify({"success": True, "users": users_list})
    except Exception as e:
        logging.error(f"Error getting registered users: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas pobierania zarejestrowanych użytkowników",
            }
        )


@app.route("/admin/api/toggle-user-status", methods=["POST"])
@require_admin_login
def api_toggle_user_status():
    try:
        data = request.get_json()
        username = (data.get("username") or "").strip()

        success = auth_manager.toggle_user_status(username)
        if success:
            db.session.commit()
            invalidate_users_cache()
            return jsonify(
                {
                    "success": True,
                    "message": f"Status użytkownika {username} został zmieniony.",
                }
            )
        else:
            return jsonify(
                {"success": False, "error": "Użytkownik nie został znaleziony"}
            )
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error toggling user status: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas zmiany statusu użytkownika",
            }
        )


@app.route("/admin/api/update-hubert-coins", methods=["POST"])
@require_admin_login
def api_update_hubert_coins():
    try:
        data = request.get_json()
        username = (data.get("username") or "").strip()
        amount = data.get("amount")

        if not username or not isinstance(amount, int):
            return jsonify({"success": False, "error": "Nieprawidłowe dane"}), 400

        success, message = auth_manager.update_hubert_coins(username, amount)

        if success:
            db.session.commit()
            invalidate_users_cache()
            return jsonify({"success": True, "message": message})
        elif "Niewystarczająca ilość" in message:
            return jsonify({"success": False, "error": message}), 400
        else:
            return jsonify({"success": False, "error": message}), 404

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating Hubert Coins: {e}")
        return jsonify(
            {"success": False, "error": "Wystąpił błąd podczas aktualizacji Hubert Coins"}
        ), 500


@app.route("/admin/api/reset-password", methods=["POST"])
@require_admin_login
def api_reset_user_password():
    try:
        data = request.get_json()
        username = (data.get("username") or "").strip()
        new_password = data.get("new_password") or ""

        if not username or not new_password:
            return jsonify(
                {
                    "success": False,
                    "error": "Nazwa użytkownika i nowe hasło są wymagane",
                }
            ), 400

        success, message = auth_manager.reset_user_password(username, new_password)

        if success:
            # Note: commit already done in auth_manager.reset_user_password()
            return jsonify({"success": True, "message": message})
        else:
            return jsonify({"success": False, "error": message}), 400
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error resetting user password: {e}")
        return jsonify(
            {
                "success": False,
                "error": "Wystąpił błąd podczas resetowania hasła użytkownika",
            }
        ), 500


@app.route("/admin/api/logs/<log_file>", methods=["GET"])
@require_admin_login
def api_get_logs(log_file):
    """API endpoint to get log file content."""
    # Security: Whitelist log files to prevent arbitrary file access
    allowed_logs = {
        "app.log": os.path.join(log_dir, "app.log"),
        "user_activity.log": os.path.join(log_dir, "user_activity.log"),
    }

    if log_file not in allowed_logs:
        return jsonify(
            {"success": False, "error": "Access to this log file is forbidden."} 
        ), 403

    log_path = allowed_logs[log_file]
    if not os.path.exists(log_path):
        return jsonify({"success": False, "error": "Log file not found."} ), 404

    temp_path = ""
    try:
        # Create a temporary copy to avoid file lock issues on Windows
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"{log_file}.tmp")
        shutil.copy2(log_path, temp_path)

        # Open with error handling for encoding issues
        with open(temp_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            last_100_lines = lines[-100:]
            return jsonify({"success": True, "log_content": "".join(last_100_lines)})

    except Exception as e:
        logging.error(f"Error reading log file {log_file}: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Could not read log file."} ), 500
    finally:
        # Clean up the temporary file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/admin/api/logs/<log_file>/download", methods=["GET"])
@require_admin_login
def api_download_log(log_file):
    """API endpoint to download a log file."""
    # Security: Whitelist log files to prevent arbitrary file access
    allowed_logs = {
        "app.log": os.path.join(log_dir, "app.log"),
        "user_activity.log": os.path.join(log_dir, "user_activity.log"),
    }

    if log_file not in allowed_logs:
        return jsonify(
            {"success": False, "error": "Access to this log file is forbidden."}
        ), 403

    log_path = allowed_logs[log_file]
    if not os.path.exists(log_path):
        return jsonify({"success": False, "error": "Log file not found."}), 404

    try:
        # Create a temporary copy to avoid file lock issues
        temp_dir = tempfile.mkdtemp()
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        download_filename = f"{log_file.replace('.log', '')}_{timestamp}.log"
        temp_path = os.path.join(temp_dir, download_filename)
        shutil.copy2(log_path, temp_path)

        logging.info(f"Admin downloaded log file: {log_file}")

        response = send_file(
            temp_path,
            as_attachment=True,
            download_name=download_filename,
            mimetype="text/plain"
        )

        @response.call_on_close
        def cleanup_after_send():
            shutil.rmtree(temp_dir, ignore_errors=True)

        return response

    except Exception as e:
        logging.error(f"Error downloading log file {log_file}: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Could not download log file."}), 500


@app.route("/admin/api/logs/download-all", methods=["GET"])
@require_admin_login
def api_download_all_logs():
    """API endpoint to download all log files as a ZIP archive."""
    try:
        temp_dir = tempfile.mkdtemp()
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        zip_filename = f"logs_{timestamp}.zip"
        zip_path = os.path.join(temp_dir, zip_filename)

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for dirpath, dirnames, filenames in os.walk(log_dir):
                for filename in filenames:
                    # Skip internal files
                    if filename.startswith("."):
                        continue
                    file_path = os.path.join(dirpath, filename)
                    arcname = os.path.relpath(file_path, log_dir)
                    zipf.write(file_path, arcname)

        logging.info(f"Admin downloaded all logs: {zip_filename}")

        response = send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype="application/zip"
        )

        @response.call_on_close
        def cleanup_after_send():
            shutil.rmtree(temp_dir, ignore_errors=True)

        return response

    except Exception as e:
        logging.error(f"Error downloading all logs: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Could not download logs."}), 500


# User authentication routes
@app.route("/register", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def register():
    all_users = auth_manager.get_all_users()
    total_registered_users = len(all_users)
    active_users = [user for user in all_users if user.is_active]
    num_active_users = len(active_users)

    top_user = None
    if all_users:
        top_user = max(all_users, key=lambda user: user.hubert_coins)

    if request.method == "POST":
        try:
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify(
                    {"success": False, "error": "Nieprawidłowy format danych żądania"}
                ), 400
            app.logger.debug(
                f"Register POST request data: {_filter_sensitive_data(data)}"
            )  # Log request data

            username_raw = data.get("username", "")
            password_raw = data.get("password", "")
            access_key_raw = data.get("access_key", "")
            referral_code_raw = data.get("referral_code", "")

            if not all(
                isinstance(field, str)
                for field in (username_raw, password_raw, access_key_raw, referral_code_raw)
            ):
                return jsonify(
                    {"success": False, "error": "Nieprawidłowy format danych"}
                ), 400

            username = username_raw.strip()
            password = password_raw.strip()
            access_key = access_key_raw.strip()
            referral_code = referral_code_raw.strip()

            # Validation
            if not username or not password or not access_key:
                response_json = {
                    "success": False,
                    "error": "Wszystkie pola są wymagane",
                }
                app.logger.debug(
                    f"Register POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json), 400

            # Register user
            success, message, recovery_token = auth_manager.register_user(
                username, password, access_key, referral_code
            )

            if success:
                response_json = {
                    "success": True,
                    "message": "Rejestracja pomyślna! Możesz się teraz zalogować.",
                }
                if recovery_token and _should_expose_recovery_token():
                    response_json["recovery_token"] = recovery_token
                app.logger.debug(
                    f"Register POST response: {_filter_sensitive_data(response_json)}"
                )  # Log response data
                return jsonify(response_json)
            else:
                response_json = {"success": False, "error": message}
                app.logger.debug(
                    f"Register POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json), 400

        except Exception as e:
            logging.error(f"Error in user registration: {e}", exc_info=True)
            db.session.rollback()
            response_json = {
                "success": False,
                "error": "Wystąpił błąd podczas rejestracji",
            }
            app.logger.debug(
                f"Register POST response: {response_json}"
            )  # Log response data
            return jsonify(response_json), 500

    return render_template(
        "register.html",
        total_registered_users=total_registered_users,
        num_active_users=num_active_users,
        top_user=top_user,
        csrf_token_func=generate_csrf,
    )


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def login():
    all_users = auth_manager.get_all_users()
    total_registered_users = len(all_users)
    active_users = [user for user in all_users if user.is_active]
    num_active_users = len(active_users)
    is_pwa_login = request.args.get("pwa") == "1"

    top_user = None
    if all_users:
        top_user = max(all_users, key=lambda user: user.hubert_coins)

    if request.method == "GET" and is_pwa_login:
        response = send_from_directory(
            os.path.join(app.static_folder, "new"),
            "login.html",
            max_age=0,
        )
        return _disable_sensitive_cache_headers(response)

    if request.method == "GET" and current_user.is_authenticated:
        next_target = request.args.get("next", "")
        if isinstance(next_target, str) and next_target.startswith("/") and not next_target.startswith("//"):
            return redirect(next_target)
        return redirect("/")

    if request.method == "POST":
        try:
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify(
                    {"success": False, "error": "Nieprawidłowy format danych żądania"}
                ), 400
            app.logger.debug(
                f"Login POST request data: {_filter_sensitive_data(data)}"
            )  # Log request data

            username_raw = data.get("username", "")
            password_raw = data.get("password", "")
            if not isinstance(username_raw, str) or not isinstance(password_raw, str):
                return jsonify(
                    {"success": False, "error": "Nieprawidłowy format danych"}
                ), 400

            username = username_raw.strip()
            password = password_raw.strip()

            app.logger.debug(
                f"Login attempt for user: '{username}' from IP: {request.remote_addr}"
            )

            if not username or not password:
                app.logger.warning(
                    f"Login failed for user '{username}': missing username or password."
                )
                response_json = {
                    "success": False,
                    "error": "Nazwa użytkownika i hasło są wymagane",
                }
                app.logger.debug(
                    f"Login POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json), 400

            # Authenticate user - metoda zwraca tuple (bool, str)
            remember = data.get("remember", False)
            success, message, user = auth_manager.authenticate_user(username, password)

            if success and user:
                _regenerate_server_session()
                login_user(user, remember=remember)
                log_user_action("Logged in successfully.")
                response_json = {"success": True, "message": "Logowanie pomyślne"}
                app.logger.debug(
                    f"Login POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json)
            else:
                log_user_action(
                    f"Failed login attempt for username '{username}'. Reason: {message}"
                )
                response_json = {"success": False, "error": message}
                app.logger.debug(
                    f"Login POST response: {response_json}"
                )  # Log response data
                return jsonify(response_json), 401

        except Exception as e:
            logging.error(f"Error in user login: {e}", exc_info=True)
            response_json = {
                "success": False,
                "error": "Wystąpił błąd podczas logowania",
            }
            app.logger.debug(
                f"Login POST response: {response_json}"
            )  # Log response data
            return jsonify(response_json)

    response = app.make_response(
        render_template(
            "login.html",
            total_registered_users=total_registered_users,
            num_active_users=num_active_users,
            top_user=top_user,
            csrf_token_func=generate_csrf,
        )
    )
    return _disable_sensitive_cache_headers(response)


@app.route("/logout")
@login_required
def logout():
    log_user_action("Logged out.")
    logout_user()
    return redirect(url_for("index"))


@app.route("/profile")
@login_required
def profile():
    log_user_action("Visited profile page.")
    # current_user is the user object from Flask-Login
    hubert_coins = current_user.hubert_coins
    created_at = current_user.created_at
    return render_template(
        "profile.html",
        hubert_coins=hubert_coins,
        created_at=created_at,
        username=current_user.username,
        csrf_token_func=generate_csrf,
    )


@app.route("/user_files/<username>/<path:filename>")
def serve_user_file(username, filename):
    # Manual authorization check for admin or file owner
    is_admin = session.get("admin_logged_in", False)
    is_owner = current_user.is_authenticated and current_user.username == username
    requested_basename = os.path.basename(filename)
    is_legacy_user_photo = (
        requested_basename == filename
        and re.match(r"^zdjecie_[\w.-]+\.(jpg|jpeg|png|gif)$", requested_basename, re.IGNORECASE)
    )

    if not is_admin and not is_owner:
        # Backward-compatibility for imported legacy HTML:
        # old files can still reference /user_files/<old_username>/zdjecie_*.jpg.
        # If the currently logged-in user has that file in their own folder, redirect
        # to the canonical URL for their username.
        if current_user.is_authenticated and is_legacy_user_photo:
            current_user_folder = os.path.join(
                os.path.abspath(USER_DATA_DIR), current_user.username, "files"
            )
            current_user_file_path = os.path.join(current_user_folder, filename)

            if is_safe_path(
                os.path.abspath(current_user_folder), os.path.abspath(current_user_file_path)
            ) and os.path.exists(current_user_file_path):
                logging.info(
                    f"Legacy user_files URL detected for '{filename}' (requested username '{username}'). "
                    f"Redirecting to current user '{current_user.username}'."
                )
                return redirect(
                    url_for(
                        "serve_user_file",
                        username=current_user.username,
                        filename=filename,
                    )
                )

        logging.warning(
            f"Unauthorized access attempt for file {filename} of user {username}."
        )
        return jsonify({"success": False, "error": "Brak uprawnień"}), 403

    # Security Check: Prevent Path Traversal attacks
    user_data_dir = os.path.abspath(USER_DATA_DIR)
    user_folder = os.path.join(user_data_dir, username, "files")
    safe_path = os.path.abspath(user_folder)

    if not os.path.normpath(safe_path).startswith(user_data_dir):
        logging.error(
            f"CRITICAL: Path Traversal attempt detected! User: {username}, Filename: {filename}"
        )
        return jsonify({"success": False, "error": "Nieprawidłowa ścieżka"}), 400

    # Check if file exists before attempting to send
    file_path = os.path.join(safe_path, filename)
    if not os.path.exists(file_path):
        return jsonify({"success": False, "error": "Plik nie znaleziony"}), 404

    response = send_from_directory(safe_path, filename)
    return _disable_sensitive_cache_headers(response)



@app.route("/logowaniedozmodyfikowanieplikuhtml")
def logowanie_do_modyfikacji():
    return render_template("logowaniedozmodyfikowanieplikuhtml.html")


@app.route("/forgot_password_page")
def forgot_password_page():
    return render_template("forgot_password_page.html")


@app.route("/reset_password_page")
def reset_password_page():
    return render_template("reset_password_page.html")


@app.route("/static/js/<path:filename>")
def serve_js_from_static(filename):
    static_folder = app.static_folder or "static"
    return send_from_directory(static_folder, "js/" + filename)


# ============== New mObywatel UI routes ==============
# Serve /assets/* from static/new/assets/ (new UI uses bare /assets/ paths)
@app.route("/assets/<path:filename>")
@limiter.exempt
def serve_new_assets(filename):
    assets_dir = os.path.join(app.static_folder, "new", "assets")
    no_store_assets = {
        "js/global/notifications-bell.js",
        "js/global/chat-feed.js",
    }
    max_age = 0 if filename in no_store_assets else 86400
    response = send_from_directory(assets_dir, filename, max_age=max_age)
    if filename in no_store_assets:
        return _disable_sensitive_cache_headers(response)
    return response


# Serve /documents → static/new/documents.html
@app.route("/documents")
@login_required
def serve_new_documents():
    response = send_from_directory(
        os.path.join(app.static_folder, "new"),
        "documents.html",
        max_age=0,
    )
    return _disable_sensitive_cache_headers(response)


# Serve /pages/* from static/new/pages/
@app.route("/pages/<path:filename>")
@login_required
def serve_new_pages(filename):
    pages_dir = os.path.join(app.static_folder, "new", "pages")
    return send_from_directory(pages_dir, filename)


# Serve /services → static/new/services.html
@app.route("/services")
@login_required
def serve_new_services():
    return send_from_directory(os.path.join(app.static_folder, "new"), "services.html", max_age=120)


# Serve /more → static/new/more.html
@app.route("/more")
@login_required
def serve_new_more():
    return send_from_directory(os.path.join(app.static_folder, "new"), "more.html", max_age=120)


# Serve /qr_code → static/new/qr_code.html
@app.route("/qr_code")
@login_required
def serve_new_qr_code():
    return send_from_directory(os.path.join(app.static_folder, "new"), "qr_code.html", max_age=120)


# Serve /api/data/get/* from static/new/api/data/get/ (static JSON data)
@app.route("/api/data/get/<path:filename>")
def serve_new_api_data(filename):
    api_dir = os.path.join(app.static_folder, "new", "api", "data", "get")
    return send_from_directory(api_dir, filename, max_age=300)


# Serve /manifest.json from static/new/ (new UI PWA manifest)
@app.route("/manifest.json")
@limiter.exempt
def serve_new_manifest():
    response = send_from_directory(
        os.path.join(app.static_folder, "new"),
        "manifest.json",
        max_age=0,
    )
    return _disable_sensitive_cache_headers(response)


# Serve /service-worker.js from static/new/ (PWA service worker)
@app.route("/service-worker.js")
@limiter.exempt
def serve_service_worker():
    return send_from_directory(os.path.join(app.static_folder, "new"), "service-worker.js", max_age=0)


# Redirect /my-document/<doc_type> to the user's generated file
@app.route("/my-document/<doc_type>")
@login_required
def my_document_redirect(doc_type):
    doc_map = {
        "mdowod": "dowodnowy_new.html",
        "mprawojazdy": "prawojazdy_new.html",
        "school_id": "school_id_new.html",
        "student_id": "student_id_new.html",
    }
    filename = doc_map.get(doc_type)
    if not filename:
        return jsonify({"success": False, "error": "Nieznany typ dokumentu"}), 404
    return redirect(url_for("user_files", filename=filename))


@app.route("/user_files/<path:filename>")
@login_required
def user_files(filename):
    user_name = current_user.username
    user_folder = os.path.join(USER_DATA_DIR, user_name)
    files_folder = os.path.join(user_folder, "files")
    file_path = os.path.join(files_folder, filename)

    if not is_safe_path(os.path.abspath(files_folder), os.path.abspath(file_path)):
        logging.warning(
            f"Potencjalna proba ataku Path Traversal na plik: {filename} dla uzytkownika: {user_name}"
        )
        return jsonify(success=False, error="Nieprawidlowa sciezka pliku"), 400

    if os.path.exists(file_path):
        response = send_from_directory(files_folder, filename)
        return _disable_sensitive_cache_headers(response)
    else:
        return jsonify(success=False, error="Plik nie znaleziony"), 404


@app.route("/api/user-documents", methods=["GET"])
@login_required
def api_user_documents():
    """Return which documents actually exist for the current user."""
    user_name = current_user.username
    files_folder = os.path.join(USER_DATA_DIR, user_name, "files")
    doc_files = {
        "mdowod": "dowodnowy_new.html",
        "mprawojazdy": "prawojazdy_new.html",
        "school_id": "school_id_new.html",
        "student_id": "student_id_new.html",
    }
    result = {}
    for key, fname in doc_files.items():
        result[key] = 1 if os.path.exists(os.path.join(files_folder, fname)) else 0
    return jsonify({"success": True, "data": {"documents": result}})


@app.route("/api/document-hashes", methods=["GET"])
@login_required
def api_document_hashes():
    """Return SHA256 hashes of the user's generated document files."""
    user_name = current_user.username
    files_folder = os.path.join(USER_DATA_DIR, user_name, "files")
    doc_files = {
        "mdowod": "dowodnowy_new.html",
        "mprawojazdy": "prawojazdy_new.html",
        "school_id": "school_id_new.html",
        "student_id": "student_id_new.html",
    }
    result = {}
    for key, fname in doc_files.items():
        fpath = os.path.join(files_folder, fname)
        result[key] = calculate_file_hash(fpath) or ""
    return jsonify({"success": True, "data": result})


@app.route("/api/user", methods=["GET"])
@login_required
def get_user():
    user_info = auth_manager.get_user_info(current_user.username)
    return jsonify(user_info)


@app.route("/admin/api/import/validate", methods=["POST"])
@require_admin_login
def api_validate_import_data():
    """Validate backup ZIP compatibility without mutating current data."""
    if "backupFile" not in request.files:
        return _admin_error("Brak pliku w żądaniu.", 400, "IMPORT_FILE_MISSING")

    file = request.files["backupFile"]
    if not file or not file.filename:
        return _admin_error("Nie wybrano pliku.", 400, "IMPORT_FILE_EMPTY")

    if not file.filename.lower().endswith(".zip"):
        return _admin_error(
            "Nieprawidłowy format pliku. Wymagany .zip",
            400,
            "IMPORT_FILE_INVALID_TYPE",
        )

    try:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_dir:
            safe_filename = os.path.basename(file.filename)
            zip_path = os.path.join(temp_dir, safe_filename)
            file.save(zip_path)

            zip_valid, zip_issues = validate_backup_zip_structure(zip_path)
            if not zip_valid:
                return jsonify(
                    {
                        "success": True,
                        "valid": False,
                        "issues": zip_issues,
                        "schema_updates_preview": [],
                        "requires_restart": True,
                    }
                )

            extracted_dir = os.path.join(temp_dir, "extracted")
            os.makedirs(extracted_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(extracted_dir)

            staged_db_path = os.path.join(extracted_dir, AUTH_DATA_DIR, "database.db")
            db_valid, db_issues = validate_imported_database(staged_db_path)
            if not db_valid:
                return jsonify(
                    {
                        "success": True,
                        "valid": False,
                        "issues": db_issues,
                        "schema_updates_preview": [],
                        "requires_restart": True,
                    }
                )

            preview_ok, schema_preview, preview_issues = preview_sqlite_schema_compatibility(
                staged_db_path
            )
            if not preview_ok:
                return jsonify(
                    {
                        "success": True,
                        "valid": False,
                        "issues": preview_issues,
                        "schema_updates_preview": [],
                        "requires_restart": True,
                    }
                )

            return jsonify(
                {
                    "success": True,
                    "valid": True,
                    "issues": [],
                    "schema_updates_preview": schema_preview,
                    "requires_restart": True,
                }
            )
    except Exception as e:
        app.logger.error(f"Import validation error: {e}", exc_info=True)
        return _admin_error(
            f"Wystąpił błąd podczas walidacji importu: {e}",
            500,
            "IMPORT_VALIDATE_INTERNAL_ERROR",
        )


@app.route("/admin/api/import/all", methods=["POST"])
@require_admin_login
def api_import_all_data():
    """Import data from backup ZIP with pre-validation and rollback-safe swap."""
    if not import_operation_lock.acquire(blocking=False):
        return _admin_error(
            "Import jest już w trakcie wykonywania.",
            409,
            "IMPORT_IN_PROGRESS",
        )

    import_id = uuid.uuid4().hex
    swap_quiesce_started = False
    try:
        if "backupFile" not in request.files:
            return _admin_error("Brak pliku w żądaniu.", 400, "IMPORT_FILE_MISSING")

        file = request.files["backupFile"]
        if not file or not file.filename:
            return _admin_error("Nie wybrano pliku.", 400, "IMPORT_FILE_EMPTY")

        if not file.filename.lower().endswith(".zip"):
            return _admin_error(
                "Nieprawidłowy format pliku. Wymagany .zip",
                400,
                "IMPORT_FILE_INVALID_TYPE",
            )

        base_path = os.path.abspath(".")
        with tempfile.TemporaryDirectory(
            prefix=f"import_stage_{import_id}_",
            dir=base_path,
            ignore_cleanup_errors=True,
        ) as temp_dir:
            safe_filename = os.path.basename(file.filename)
            zip_path = os.path.join(temp_dir, safe_filename)
            file.save(zip_path)

            zip_valid, zip_issues = validate_backup_zip_structure(zip_path)
            if not zip_valid:
                return _admin_error(
                    "Nieprawidłowy plik ZIP.",
                    400,
                    "IMPORT_ZIP_INVALID",
                    zip_issues,
                )

            extracted_dir = os.path.join(temp_dir, "extracted")
            os.makedirs(extracted_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(extracted_dir)

            staged_db_path = os.path.join(extracted_dir, AUTH_DATA_DIR, "database.db")
            db_valid, db_issues = validate_imported_database(staged_db_path)
            if not db_valid:
                return _admin_error(
                    "Nieprawidłowa baza danych w archiwum.",
                    400,
                    "IMPORT_DB_INVALID",
                    db_issues,
                )

            preview_ok, schema_preview, preview_issues = preview_sqlite_schema_compatibility(
                staged_db_path
            )
            if not preview_ok:
                return _admin_error(
                    "Nie udało się odczytać schematu importowanej bazy.",
                    400,
                    "IMPORT_SCHEMA_PREVIEW_FAILED",
                    preview_issues,
                )

            schema_ok, schema_updates_applied, schema_errors = ensure_sqlite_schema_compatibility(
                staged_db_path
            )
            if not schema_ok:
                return _admin_error(
                    "Import danych zakończony, ale wykryto błąd zgodności schematu bazy.",
                    500,
                    "IMPORT_SCHEMA_COMPAT_FAILED",
                    schema_errors,
                )

            # Pause competing requests during critical filesystem swap phase.
            import_swap_quiesce_event.set()
            swap_quiesce_started = True
            # Give in-flight requests a brief moment to finish DB work.
            time.sleep(0.35)
            _release_database_handles_for_import("pre-swap")

            swap_ok, swap_error = swap_import_data_with_rollback(
                staged_root=extracted_dir,
                base_path=base_path,
                import_id=import_id,
            )
            if not swap_ok:
                return _admin_error(
                    "Nie udało się podmienić danych importu.",
                    500,
                    "IMPORT_SWAP_FAILED",
                    [swap_error],
                )

            _release_database_handles_for_import("post-swap")

            app.logger.info(
                f"[request_id={_request_id()} import_id={import_id}] Import zakończony sukcesem."
            )
            return jsonify(
                {
                    "success": True,
                    "message": "Import zakończony pomyślnie. Zrestartuj serwer, aby zastosować zmiany w bazie danych.",
                    "import_id": import_id,
                    "requires_restart": True,
                    "schema_updates_preview": schema_preview,
                    "schema_updates_applied": schema_updates_applied,
                }
            )
    except Exception as e:
        logging.error(
            f"[request_id={_request_id()} import_id={import_id}] Error during data import: {e}",
            exc_info=True,
        )
        return _admin_error(
            f"Wystąpił błąd podczas importu: {e}",
            500,
            "IMPORT_INTERNAL_ERROR",
        )
    finally:
        if swap_quiesce_started:
            import_swap_quiesce_event.clear()
        if import_operation_lock.locked():
            import_operation_lock.release()


# Rate limiting dla restartu - max 1 na minutę
_last_restart_time = 0
RESTART_COOLDOWN = 60  # sekund

@app.route("/admin/api/restart", methods=["POST"])
@require_admin_login
def api_restart_server():
    """API endpoint for admin to restart the server service (requires sudoers config)."""
    global _last_restart_time
    if not restart_operation_lock.acquire(blocking=False):
        return _admin_error(
            "Restart jest już w trakcie wykonywania.",
            409,
            "RESTART_IN_PROGRESS",
        )

    current_time = time.time()
    
    # Rate limiting - max 1 restart na minutę
    if current_time - _last_restart_time < RESTART_COOLDOWN:
        remaining = int(RESTART_COOLDOWN - (current_time - _last_restart_time))
        restart_operation_lock.release()
        return _admin_error(
            f"Poczekaj {remaining} sekund przed kolejnym restartem.",
            429,
            "RESTART_RATE_LIMIT",
        )
    
    try:
        # Loguj próbę restartu
        app.logger.warning(
            f"[request_id={_request_id()}] Server restart initiated by admin from IP: {request.remote_addr}"
        )
        
        # Wykonaj restart usługi (wymaga konfiguracji sudoers)
        # Używamy pełnych ścieżek - systemctl może być w /bin lub /usr/bin
        systemctl_path = shutil.which("systemctl") or "/usr/bin/systemctl"
        sudo_path = shutil.which("sudo") or "/usr/bin/sudo"
        
        app.logger.info(f"Attempting restart with: {sudo_path} {systemctl_path} restart mobywatel")
        
        result = subprocess.run(
            [sudo_path, systemctl_path, "restart", "mobywatel"],
            capture_output=True,
            text=True,
            timeout=30,
            env={"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"}
        )
        
        app.logger.info(f"Restart result: returncode={result.returncode}, stdout={result.stdout}, stderr={result.stderr}")
        
        if result.returncode == 0:
            _last_restart_time = current_time
            app.logger.info("Server restart command executed successfully")
            return jsonify({
                "success": True,
                "message": "Restart serwera został zainicjowany. Strona odświeży się automatycznie."
            })
        else:
            error_msg = result.stderr or result.stdout or 'Nieznany błąd'
            app.logger.error(f"Restart failed: returncode={result.returncode}, stderr={result.stderr}, stdout={result.stdout}")
            return _admin_error(
                f"Błąd restartu (kod {result.returncode}): {error_msg}. Sprawdź konfigurację sudoers.",
                500,
                "RESTART_FAILED",
            )
             
    except subprocess.TimeoutExpired:
        return _admin_error(
            "Timeout podczas restartu serwera.",
            500,
            "RESTART_TIMEOUT",
        )
    except FileNotFoundError:
        return _admin_error(
            "Komenda systemctl nie znaleziona. Restart dostępny tylko na serwerze Linux.",
            500,
            "RESTART_UNSUPPORTED_ENV",
        )
    except Exception as e:
        app.logger.error(f"Restart error: {e}", exc_info=True)
        return _admin_error(f"Błąd: {str(e)}", 500, "RESTART_INTERNAL_ERROR")
    finally:
        if restart_operation_lock.locked():
            restart_operation_lock.release()


@app.route("/admin/api/export/all", methods=["GET"])
@require_admin_login
def export_all_data():
    """Exports all user data (including user logs) and the database into a single zip file."""
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp()
        zip_filename = (
            f"mobywatel_backup_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        )
        zip_path = os.path.join(temp_dir, zip_filename)

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            # 1. Add user_data directory
            user_data_path = os.path.abspath(USER_DATA_DIR)
            if os.path.exists(user_data_path):
                for root, _, files in os.walk(user_data_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(
                            file_path, os.path.dirname(user_data_path)
                        )
                        zipf.write(file_path, arcname)

            # 2. Add auth_data directory (including database)
            auth_data_path = os.path.abspath(AUTH_DATA_DIR)
            if os.path.exists(auth_data_path):
                for root, _, files in os.walk(auth_data_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(
                            file_path, os.path.dirname(auth_data_path)
                        )
                        zipf.write(file_path, arcname)

        log_user_action(f"Exported all user data to {zip_filename}")
        
        response = send_file(zip_path, as_attachment=True, download_name=zip_filename)
        
        @response.call_on_close
        def cleanup_after_send():
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        return response

    except Exception as e:
        # Cleanup on error
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        logging.error(f"Failed to export all data: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "Błąd podczas eksportu danych."} 
        ), 500


@app.route("/api/announcements", methods=["GET"])
@login_required
def get_announcements():
    """Return active announcements for the logged-in user."""
    announcements = announcement_service.get_active_announcements()
    return jsonify([
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "type": a.type,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in announcements
    ])


@app.route("/api/notifications", methods=["GET"])
@login_required
def get_notifications():
    notifications = notification_service.get_notifications(current_user.username)
    return jsonify(notifications)


def _serialize_chat_message(chat_message: ChatMessage) -> dict[str, object]:
    created_at = chat_message.created_at
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return {
        "id": chat_message.id,
        "user_id": chat_message.user_id,
        "message": chat_message.message,
        "created_at": created_at.isoformat() if created_at else None,
        "is_own": chat_message.user_id == current_user.username,
    }


def _parse_optional_nonnegative_int(value, field_name: str):
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"Nieprawidłowa wartość pola {field_name}.")
    if parsed < 0:
        raise ValueError(f"Pole {field_name} nie może być ujemne.")
    return parsed


@app.route("/api/chat/unread", methods=["GET"])
@login_required
def get_chat_unread():
    unread_count = chat_service.get_unread_count(current_user.username)
    last_message_id = chat_service.get_last_message_id()
    return _json_no_store(
        {
            "success": True,
            "unread_count": unread_count,
            "last_message_id": last_message_id,
        }
    )


@app.route("/api/chat/messages", methods=["GET"])
@login_required
def get_chat_messages():
    try:
        after_id = _parse_optional_nonnegative_int(request.args.get("after_id"), "after_id")
        limit = _parse_optional_nonnegative_int(request.args.get("limit"), "limit")
    except ValueError as exc:
        return _json_no_store({"success": False, "error": str(exc)}, 400)

    effective_limit = limit or ChatService.MAX_HISTORY_LIMIT
    if after_id is None:
        messages = chat_service.get_recent_messages(effective_limit)
    else:
        messages = chat_service.get_messages_after(after_id, effective_limit)

    unread_count = chat_service.get_unread_count(current_user.username)
    last_message_id = chat_service.get_last_message_id()
    return _json_no_store(
        {
            "success": True,
            "items": [_serialize_chat_message(message) for message in messages],
            "unread_count": unread_count,
            "last_message_id": last_message_id,
        }
    )


@app.route("/api/chat/messages", methods=["POST"])
@csrf.exempt
@login_required
def post_chat_message():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _json_no_store({"success": False, "error": "Nieprawidłowy format danych"}, 400)

    message_raw = data.get("message", "")
    if not isinstance(message_raw, str):
        return _json_no_store({"success": False, "error": "Nieprawidłowy format wiadomości"}, 400)

    message = message_raw.strip()
    if not message:
        return _json_no_store({"success": False, "error": "Wiadomość nie może być pusta"}, 400)
    if len(message) > 2000:
        return _json_no_store({"success": False, "error": "Wiadomość może mieć maksymalnie 2000 znaków"}, 400)

    chat_message = chat_service.create_message(current_user.username, message)
    return _json_no_store(
        {
            "success": True,
            "item": _serialize_chat_message(chat_message),
        },
        201,
    )


@app.route("/api/chat/read", methods=["POST"])
@csrf.exempt
@login_required
def mark_chat_as_read():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _json_no_store({"success": False, "error": "Nieprawidłowy format danych"}, 400)

    try:
        last_seen_id = _parse_optional_nonnegative_int(data.get("last_seen_id"), "last_seen_id")
    except ValueError as exc:
        return _json_no_store({"success": False, "error": str(exc)}, 400)

    if last_seen_id is None:
        return _json_no_store({"success": False, "error": "Brak last_seen_id"}, 400)

    unread_count = chat_service.mark_read(current_user.username, last_seen_id)
    return _json_no_store({"success": True, "unread_count": unread_count})


@app.route("/api/notifications/read", methods=["POST"])
@csrf.exempt
@login_required
def mark_notification_as_read():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "Nieprawidłowy format danych"}), 400

    notification_id = data.get("id")
    if notification_id is not None:
        try:
            notification_id_int = int(notification_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "Nieprawidłowe ID powiadomienia"}), 400

        marked = notification_service.mark_notification_as_read(
            notification_id_int, user_id=current_user.username
        )
        if not marked:
            return jsonify({"success": False, "error": "Powiadomienie nie znalezione"}), 404

        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Brak ID powiadomienia"})


@app.route("/api/announcements/delete/<int:announcement_id>", methods=["DELETE"])
@login_required
def delete_announcement(announcement_id):
    """Legacy endpoint: users cannot globally deactivate announcements."""
    if not session.get("admin_logged_in", False):
        return jsonify(
            {
                "success": False,
                "error": "Brak uprawnień do usuwania ogłoszeń globalnych.",
            }
        ), 403

    return _admin_delete_announcement(announcement_id)


@app.route("/admin/api/announcements/delete/<int:announcement_id>", methods=["DELETE"])
@require_admin_login
def admin_delete_announcement(announcement_id):
    """Admin endpoint to deactivate a global announcement."""
    return _admin_delete_announcement(announcement_id)


def _admin_delete_announcement(announcement_id):
    """Deactivate a global announcement."""
    try:
        success = announcement_service.deactivate_announcement(announcement_id)
        if success:
            logging.info(
                f"Announcement {announcement_id} deactivated by admin '{session.get('admin_username', 'unknown')}'."
            )
            return jsonify({"success": True, "message": "Ogłoszenie zostało usunięte."})
        else:
            return jsonify(
                {
                    "success": False,
                    "error": "Nie znaleziono ogłoszenia.",
                }
            ), 404
    except Exception as e:
        logging.error(
            f"Error deleting announcement {announcement_id}: {e}",
            exc_info=True,
        )
        return jsonify(
            {"success": False, "error": "Wystąpił wewnętrzny błąd serwera."}
        ), 500


# ... (reszta kodu app.py)


# =====================================================
# Impersonation Endpoints
# =====================================================
@app.route("/admin/api/impersonate/start", methods=["POST"])
@require_admin_login
def start_impersonation():
    """Starts an impersonation session for a given user."""
    data = request.get_json()
    username_to_impersonate = data.get("username")

    if not username_to_impersonate:
        return jsonify({"success": False, "error": "Nazwa użytkownika jest wymagana."}), 400

    user_to_impersonate = auth_manager.get_user_by_id(username_to_impersonate)
    if not user_to_impersonate:
        return jsonify({"success": False, "error": "Użytkownik do impersonacji nie został znaleziony."}), 404

    if not user_to_impersonate.is_active:
        return jsonify({"success": False, "error": "Nie można impersonować nieaktywnego użytkownika."}), 400

    # CORRECTED: Get admin username directly from the session
    original_admin_id = session.get("admin_username")
    if not original_admin_id:
        return jsonify({"success": False, "error": "Nie można zidentyfikować administratora w sesji."}), 500

    # Log in the new user using Flask-Login to populate the session correctly.
    login_user(user_to_impersonate)

    # Store impersonation state and explicitly remove admin auth flags while impersonating.
    session["original_admin_id"] = original_admin_id
    session["is_impersonating"] = True
    session["impersonated_user_id"] = user_to_impersonate.get_id()  # Keep this for logging purposes
    session.pop("admin_logged_in", None)
    session.pop("admin_username", None)

    # Log this critical action.
    log_user_action(
        f"IMPERSONATION STARTED: Admin '{original_admin_id}' is now impersonating user '{username_to_impersonate}'."
    )

    session.modified = True

    return jsonify({"success": True, "message": f"Rozpoczęto impersonację użytkownika {username_to_impersonate}."})


@app.route("/admin/api/impersonate/stop", methods=["POST"])
def stop_impersonation():
    """Stops the current impersonation session."""
    if not session.get("is_impersonating"):
        return jsonify({"success": False, "error": "Brak aktywnej sesji impersonacji."}), 400

    original_admin_id = session.get("original_admin_id")
    impersonated_user_id = session.get("impersonated_user_id")

    if not original_admin_id:
        return jsonify({"success": False, "error": "Nie można zakończyć sesji: brak oryginalnego ID admina."}), 500

    # Log this critical action before clearing session
    log_user_action(
        f"IMPERSONATION STOPPED: Admin '{original_admin_id}' stopped impersonating user '{impersonated_user_id}'."
    )

    # Log out the impersonated user
    logout_user()

    # Clean up all impersonation keys
    session.pop("is_impersonating", None)
    session.pop("impersonated_user_id", None)
    session.pop("original_admin_id", None)

    # Log the original admin back in
    admin_user = auth_manager.get_user_by_id(original_admin_id)
    if admin_user:
        login_user(admin_user) # Use login_user to properly set up the session
    else:
        app.logger.warning(
            f"Original admin user '{original_admin_id}' not found in database during impersonation stop; restoring admin session flags only."
        )

    # Always restore admin panel session flags.
    session["admin_logged_in"] = True
    session["admin_username"] = original_admin_id
    
    session.modified = True
    
    return jsonify({"success": True, "message": "Zakończono impersonację."})


if __name__ == "__main__":
    # Development server configuration
    app.run(debug=True, host="0.0.0.0", port=5000)
