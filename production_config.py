"""
Konfiguracja produkcyjna dla aplikacji Dowodnowy HTML App
"""

import os


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


class ProductionConfig:
    # Bezpieczeństwo
    SECRET_KEY = os.environ.get("SECRET_KEY")

    # Flask settings
    DEBUG = False
    TESTING = False

    # Session settings
    SESSION_COOKIE_SECURE = True  # Tylko HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = 3600  # 1 godzina

    # Security headers
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 rok dla plików statycznych

    # Upload settings
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max upload (dla backupów)

    # Logging
    LOG_LEVEL = "INFO"
    LOG_FILE = "logs/app.log"

    # Database (jeśli będzie używana w przyszłości)
    # DATABASE_URL = os.environ.get('DATABASE_URL')

    # Admin credentials (zmień w produkcji!)
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
    EXPOSE_RESET_TOKEN = False
    EXPOSE_RECOVERY_TOKEN = False
    RECOVERY_TOKEN_TTL_HOURS = _env_int("RECOVERY_TOKEN_TTL_HOURS", 24)
    IMPORT_MAX_UNCOMPRESSED_BYTES = _env_int(
        "IMPORT_MAX_UNCOMPRESSED_BYTES", 500 * 1024 * 1024
    )
    IMPORT_MAX_FILES = _env_int("IMPORT_MAX_FILES", 10_000)
    IMPORT_MAX_SINGLE_FILE_BYTES = _env_int(
        "IMPORT_MAX_SINGLE_FILE_BYTES", 100 * 1024 * 1024
    )
    IMPORT_MAX_COMPRESSION_RATIO = _env_int("IMPORT_MAX_COMPRESSION_RATIO", 100)

    # Rate limiting (wymaga Redis w produkcji dla wielu instancji)
    # Użyj "memory://" tylko dla pojedynczej instancji lub środowiska deweloperskiego.
    RATELIMIT_STORAGE_URL = os.environ.get(
        "RATELIMIT_STORAGE_URL", "redis://redis:6379"
    )

    @staticmethod
    def init_app(app):
        """Inicjalizacja konfiguracji dla aplikacji Flask"""
        import logging
        from logging.handlers import RotatingFileHandler
        from pythonjsonlogger import jsonlogger

        if not app.debug and not app.testing:
            # Tworzenie katalogu logs jeśli nie istnieje
            if not os.path.exists("logs"):
                os.mkdir("logs")

            # Konfiguracja rotacji logów z formatowaniem JSON
            log_file = ProductionConfig.LOG_FILE
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=10240000,  # 10MB
                backupCount=10,
            )

            # Definicja formatu JSON
            formatter = jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
            )

            file_handler.setFormatter(formatter)
            app.logger.addHandler(file_handler)
            app.logger.setLevel(logging.INFO)
            app.logger.info(
                "Aplikacja Dowodnowy HTML uruchomiona w trybie produkcyjnym z logowaniem JSON."
            )


class DevelopmentConfig:
    """Konfiguracja deweloperska"""

    DEBUG = True
    SECRET_KEY = "dev-secret-key-change-in-production"
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max upload for development (dla backupów)
    EXPOSE_RESET_TOKEN = os.environ.get("EXPOSE_RESET_TOKEN", "false").lower() in (
        "1",
        "true",
        "yes",
    )
    EXPOSE_RECOVERY_TOKEN = os.environ.get("EXPOSE_RECOVERY_TOKEN", "true").lower() in (
        "1",
        "true",
        "yes",
    )
    RECOVERY_TOKEN_TTL_HOURS = _env_int("RECOVERY_TOKEN_TTL_HOURS", 24)
    IMPORT_MAX_UNCOMPRESSED_BYTES = _env_int(
        "IMPORT_MAX_UNCOMPRESSED_BYTES", 500 * 1024 * 1024
    )
    IMPORT_MAX_FILES = _env_int("IMPORT_MAX_FILES", 10_000)
    IMPORT_MAX_SINGLE_FILE_BYTES = _env_int(
        "IMPORT_MAX_SINGLE_FILE_BYTES", 100 * 1024 * 1024
    )
    IMPORT_MAX_COMPRESSION_RATIO = _env_int("IMPORT_MAX_COMPRESSION_RATIO", 100)
    RATELIMIT_STORAGE_URL = os.environ.get("RATELIMIT_STORAGE_URL", "memory://")

    @staticmethod
    def init_app(app):
        pass


# Wybór konfiguracji na podstawie zmiennej środowiskowej
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
