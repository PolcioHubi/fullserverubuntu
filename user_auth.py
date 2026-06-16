import logging
import bcrypt
import hashlib
import secrets
import datetime
from typing import List, Optional, Tuple
from flask import current_app, has_app_context
from flask_login import UserMixin
from sqlalchemy.exc import IntegrityError
from models import db, User
from services import AccessKeyService, NotificationService


def _utc_naive_now() -> datetime.datetime:
    """Return the current UTC time as a *naive* datetime.

    SQLAlchemy's ``DateTime`` columns are timezone-naive in this schema, and
    ``func.now()`` on SQLite already records UTC. Using ``datetime.now()``
    instead pulls the local timezone of the worker process — which silently
    miscompares against rows persisted via ``func.now()``. This helper
    keeps everything on a single naive-UTC clock without requiring a DB
    schema migration to ``DateTime(timezone=True)``.
    """
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


# Add UserMixin to the User model from models.py for Flask-Login compatibility
class AuthUser(User, UserMixin):
    def get_id(self):
        return self.username


class UserAuthManager:
    # Security settings
    BCRYPT_ROUNDS = 12  # Adjust based on performance needs (higher = more secure but slower)
    
    def __init__(
        self,
        access_key_service: AccessKeyService,
        notification_service: NotificationService,
    ):
        """Initializes the manager with its dependencies."""
        self.access_key_service = access_key_service
        self.notification_service = notification_service

    @staticmethod
    def _validate_password_length(password: str) -> Optional[str]:
        """Validate password length against both UX limits and bcrypt's 72-byte cap.

        Returns ``None`` when the password is acceptable, otherwise the
        user-facing error message. Centralizing this avoids accidentally
        forgetting one of the password-setting paths (register, reset,
        recovery token, password reset token).
        """
        if len(password) < 6 or len(password) > 100:
            return "Hasło musi mieć od 6 do 100 znaków"
        if len(password.encode("utf-8")) > 72:
            return "Hasło jest zbyt długie. Skróć je lub usuń znaki specjalne (limit 72 bajty UTF-8)."
        return None

    def _hash_password(self, password: str) -> str:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=self.BCRYPT_ROUNDS))
        return hashed.decode("utf-8")

    def _check_password(self, hashed_password: str, password: str) -> bool:
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"), hashed_password.encode("utf-8")
            )
        except (ValueError, TypeError):
            return False

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def validate_referral_code(self, code: str) -> bool:
        """Checks if a referral code (username) exists and is active."""
        user = User.query.filter_by(username=code, is_active=True).first()
        return user is not None

    def register_user(
        self,
        username: str,
        password: str,
        access_key: str,
        referral_code: Optional[str] = None,
        mark_tutorial_seen: bool = False,
    ) -> Tuple[bool, str, Optional[str]]:
        try:
            username = username.strip()
            logging.info(f"Attempting to register user: {username}")
            
            # Validate access key length to prevent DoS
            if len(access_key) > 256:
                logging.warning(f"Registration failed for {username}: Access key too long")
                return False, "Nieprawidłowy klucz dostępu", None
            
            is_valid, error_msg = self.access_key_service.validate_access_key(
                access_key
            )
            logging.info(
                f"Access key validation result: is_valid={is_valid}, error_msg={error_msg}"
            )
            if not is_valid:
                logging.warning(
                    f"Registration failed for {username}: Invalid access key - {error_msg}"
                )
                return False, error_msg, None

            if len(username) < 3:
                logging.warning(
                    f"Registration failed for {username}: Username too short (length: {len(username)})."
                )
                return False, "Nazwa użytkownika musi mieć co najmniej 3 znaki", None
            if len(username) > 50:
                logging.warning(
                    f"Registration failed for {username}: Username too long (length: {len(username)})."
                )
                return False, "Nazwa użytkownika może mieć maksymalnie 50 znaków", None
            # Ensure username is safe for filesystem-backed user directories.
            forbidden_chars = set('<>:"/\\|?*')
            if (
                "\x00" in username
                or username.startswith(".")
                or ".." in username
                or any(char in forbidden_chars for char in username)
                or any(ord(char) < 32 for char in username)
            ):
                logging.warning(
                    f"Registration failed for {username}: Username contains forbidden characters."
                )
                return False, "Nazwa użytkownika zawiera niedozwolone znaki", None
            if len(password) < 6:
                logging.warning(
                    f"Registration failed for {username}: Password too short (length: {len(password)})."
                )
                return False, "Hasło musi mieć co najmniej 6 znaków", None
            if len(password) > 100:
                logging.warning(
                    f"Registration failed for {username}: Password too long (length: {len(password)})."
                )
                return False, "Hasło może mieć maksymalnie 100 znaków", None
            # bcrypt silently truncates passwords beyond 72 BYTES (not chars).
            # A 100-char password full of Polish diacritics or emoji can exceed
            # that, so the bcrypt-stored hash would only cover the first 72
            # bytes — invisible loss of entropy. Reject explicitly.
            if len(password.encode("utf-8")) > 72:
                logging.warning(
                    f"Registration failed for {username}: Password byte length exceeds bcrypt 72-byte limit."
                )
                return (
                    False,
                    "Hasło jest zbyt długie. Skróć je lub usuń znaki specjalne (limit 72 bajty UTF-8).",
                    None,
                )

            # Best-effort early reject for nicer UX. The authoritative race-safe
            # check is the UNIQUE constraint on User.username enforced at COMMIT
            # below — two concurrent requests can both pass this lookup, only
            # one will reach commit successfully.
            user_exists = User.query.filter_by(username=username).first()
            if user_exists:
                logging.warning(
                    f"Registration failed for {username}: Username already exists."
                )
                return False, "Użytkownik o tej nazwie już istnieje", None

            hashed_password = self._hash_password(password)
            recovery_token = secrets.token_urlsafe(16)
            recovery_token_hash = self._hash_token(recovery_token)
            recovery_token_ttl_hours = 24
            if has_app_context():
                try:
                    recovery_token_ttl_hours = int(
                        current_app.config.get("RECOVERY_TOKEN_TTL_HOURS", 24)
                    )
                except (TypeError, ValueError):
                    recovery_token_ttl_hours = 24
            recovery_token_expires = _utc_naive_now() + datetime.timedelta(
                hours=max(1, recovery_token_ttl_hours)
            )

            access_key_used = self.access_key_service.use_access_key(
                access_key, commit=False
            )
            if not access_key_used:
                db.session.rollback()
                return (
                    False,
                    "Ten klucz dostępu został już wykorzystany lub jest nieaktywny.",
                    None,
                )

            new_user = User(
                username=username,
                password=hashed_password,
                access_key_used=access_key,
                recovery_token=recovery_token_hash,
                recovery_token_expires=recovery_token_expires,
                has_seen_tutorial=mark_tutorial_seen,  # Set tutorial status
            )
            db.session.add(new_user)

            message = "Użytkownik zarejestrowany pomyślnie"
            if (
                referral_code
                and referral_code != username
                and self.validate_referral_code(referral_code)
            ):
                # Atomic UPDATE instead of read-modify-write: two concurrent
                # registrations referring the same user would otherwise both
                # read the old balance and lose one increment.
                updated = (
                    User.query.filter_by(username=referral_code).update(
                        {User.hubert_coins: User.hubert_coins + 1},
                        synchronize_session=False,
                    )
                )
                if updated:
                    message += ". Otrzymałeś 1 Hubert Coin za polecenie!"

            self.notification_service.create_notification(
                username,
                "Witaj w mObywatel! Dziękujemy za rejestrację.",
                commit=False,
            )

            db.session.commit()
            logging.info(f"User {username} registered successfully.")
            return True, message, recovery_token
        except IntegrityError as exc:
            db.session.rollback()
            # Disambiguate which UNIQUE constraint actually fired so the user
            # gets a precise message instead of "either username or access key".
            # SQLite/Postgres/MySQL all surface the column name in the error
            # text, just under different formats — match conservatively.
            err_text = str(getattr(exc, "orig", exc)).lower()
            if "username" in err_text or "users.username" in err_text or "users_pkey" in err_text:
                logging.warning(
                    f"Registration failed for {username}: race lost on username UNIQUE."
                )
                return False, "Użytkownik o tej nazwie już istnieje", None
            if "access_key_used" in err_text or "users.access_key_used" in err_text:
                logging.warning(
                    f"Registration failed for {username}: race lost on access_key_used UNIQUE."
                )
                return (
                    False,
                    "Ten klucz dostępu został już wykorzystany.",
                    None,
                )
            logging.warning(
                f"Registration failed for {username}: IntegrityError - {err_text!r}"
            )
            return (
                False,
                "Ten klucz dostępu został już wykorzystany lub nazwa użytkownika jest zajęta.",
                None,
            )
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error during user registration for {username}: {e}", exc_info=True
            )
            return False, "Wystąpił wewnętrzny błąd serwera podczas rejestracji.", None

    def authenticate_user(
        self, username: str, password: str
    ) -> Tuple[bool, str, Optional[AuthUser]]:
        logging.info(f"Attempting to authenticate user: {username}")
        user = User.query.filter_by(username=username).first()

        if not user:
            logging.warning(f"Authentication failed for {username}: User not found.")
            return False, "Nieprawidłowa nazwa użytkownika lub hasło", None

        if not user.is_active:
            logging.warning(
                f"Authentication failed for {username}: User account is inactive."
            )
            return False, "Konto użytkownika zostało dezaktywowane", None

        if self._check_password(user.password, password):
            user.last_login = _utc_naive_now()
            db.session.commit()
            auth_user = db.session.get(AuthUser, user.username)
            logging.info(f"User {username} authenticated successfully.")
            return True, "Logowanie pomyślne", auth_user

        logging.warning(f"Authentication failed for {username}: Incorrect password.")
        return False, "Nieprawidłowa nazwa użytkownika lub hasło", None

    def get_user_by_id(self, user_id: str) -> Optional[AuthUser]:
        return AuthUser.query.filter_by(username=user_id).first()

    def get_all_users(self) -> List[User]:
        """Return all users ordered by registration date (newest first).

        Note: returned User instances include the bcrypt password hash on the
        ``password`` field. Templates and serializers must not echo it back to
        clients. The previous ``include_passwords`` parameter was unused and
        was removed to avoid suggesting an opt-out that did nothing.

        Heads-up: this loads every row into Python. For places that only need
        counts or a top-N user, prefer ``count_users``, ``count_active_users``
        or ``get_top_user_by_coins`` — they push aggregation into SQL.
        """
        return User.query.order_by(User.created_at.desc()).all()

    def count_users(self) -> int:
        """Count all registered users via SQL ``COUNT(*)`` — no row hydration."""
        return int(db.session.query(db.func.count(User.username)).scalar() or 0)

    def count_active_users(self) -> int:
        """Count users with ``is_active = True``."""
        return int(
            db.session.query(db.func.count(User.username))
            .filter(User.is_active.is_(True))
            .scalar()
            or 0
        )

    def get_top_user_by_coins(self) -> Optional[User]:
        """Return the single user with the highest hubert_coins balance.

        Uses ``ORDER BY hubert_coins DESC LIMIT 1`` so the cost is one indexed
        scan, not loading the whole users table.
        """
        return (
            User.query.order_by(User.hubert_coins.desc(), User.username.asc())
            .limit(1)
            .first()
        )

    def toggle_user_status(self, username: str) -> bool:
        user = User.query.filter_by(username=username).first()
        if user:
            user.is_active = not user.is_active
            db.session.commit()
            return True
        return False

    def delete_user(self, username: str) -> bool:
        user = User.query.filter_by(username=username).first()
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False

    def update_hubert_coins(self, username: str, amount: int) -> Tuple[bool, str]:
        try:
            base_query = User.query.filter_by(username=username)
            if amount < 0:
                # Atomic guard to prevent race-driven negative balances.
                base_query = base_query.filter(User.hubert_coins >= -amount)

            updated_rows = base_query.update(
                {User.hubert_coins: User.hubert_coins + amount},
                synchronize_session=False,
            )

            if updated_rows == 0:
                user = User.query.filter_by(username=username).first()
                db.session.rollback()
                if not user:
                    return False, "Użytkownik nie został znaleziony"
                return False, "Niewystarczająca ilość Hubert Coins"

            db.session.commit()
            new_balance = (
                User.query.with_entities(User.hubert_coins)
                .filter_by(username=username)
                .scalar()
            )
            return True, f"Zaktualizowano saldo Hubert Coins do: {new_balance}"
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error updating Hubert Coins for {username}: {e}", exc_info=True
            )
            return False, "Wystąpił błąd podczas aktualizacji Hubert Coins"

    def reset_user_password(self, username: str, new_password: str) -> Tuple[bool, str]:
        err = self._validate_password_length(new_password)
        if err is not None:
            return False, err

        user = User.query.filter_by(username=username).first()
        if not user:
            return False, "Użytkownik nie został znaleziony"

        user.password = self._hash_password(new_password)
        db.session.commit()
        return True, "Hasło zostało zresetowane"

    def generate_password_reset_token(self, username: str) -> Optional[str]:
        user = User.query.filter_by(username=username).first()
        if not user:
            return None

        token = secrets.token_urlsafe(32)
        user.password_reset_token = self._hash_token(token)
        user.password_reset_expires = _utc_naive_now() + datetime.timedelta(
            hours=1
        )
        db.session.commit()
        return token

    def reset_user_password_with_token(
        self, token: str, new_password: str
    ) -> Tuple[bool, str]:
        token_hash = self._hash_token(token)
        user = User.query.filter_by(password_reset_token=token_hash).first()

        if not user:
            return False, "Nieprawidłowy token"

        if _utc_naive_now() > user.password_reset_expires:
            return False, "Token wygasł"

        err = self._validate_password_length(new_password)
        if err is not None:
            return False, err

        user.password = self._hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        db.session.commit()
        return True, "Hasło zostało pomyślnie zresetowane"

    def reset_password_with_recovery_token(
        self, username: str, recovery_token: str, new_password: str
    ) -> Tuple[bool, str]:
        err = self._validate_password_length(new_password)
        if err is not None:
            return False, err

        user = User.query.filter_by(
            username=username, recovery_token=self._hash_token(recovery_token)
        ).first()
        if not user:
            return False, "Nieprawidłowa nazwa użytkownika lub token odzyskiwania"
        if (
            user.recovery_token_expires is None
            or _utc_naive_now() > user.recovery_token_expires
        ):
            return False, "Nieprawidłowa nazwa użytkownika lub token odzyskiwania"

        user.password = self._hash_password(new_password)
        user.recovery_token = None
        user.recovery_token_expires = None
        db.session.commit()
        return True, "Hasło zostało pomyślnie zresetowane"

    def get_user_info(self, username: str) -> Optional[dict]:
        user = User.query.filter_by(username=username).first()
        if not user:
            return None
        return {
            "username": user.username,
            "created_at": user.created_at,
            "last_login": user.last_login,
            "hubert_coins": user.hubert_coins,
            "is_active": user.is_active,
            "referral_code": user.username,  # User's own referral code is their username
        }
