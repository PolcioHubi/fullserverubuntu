import hashlib
import logging
import secrets
import datetime
from typing import Dict, List, Optional, Tuple, Any
from models import db, AccessKey, Announcement, ChatMessage, File, Notification, User
from sqlalchemy import func, desc
from sqlalchemy.exc import IntegrityError


def _utc_naive_now() -> datetime.datetime:
    """UTC-naive "now" — see user_auth._utc_naive_now docstring."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _key_ref(key_val: str) -> str:
    """Non-reversible reference for logging access keys.

    Access keys are single-use bearer credentials; logging them verbatim let
    anyone with log/backup read access replay an unused key to register an
    account. We log only a short SHA-256 prefix so log lines stay correlatable
    without exposing the secret.
    """
    if not key_val:
        return "<none>"
    return "sha256:" + hashlib.sha256(key_val.encode("utf-8")).hexdigest()[:12]


class AccessKeyService:
    """Manages all operations related to access keys using SQLAlchemy."""

    def generate_access_key(self, description: str = "", expires_days: int = 30) -> str:
        try:
            key_val = secrets.token_urlsafe(32)
            expires_at = None
            if expires_days > 0:
                expires_at = _utc_naive_now() + datetime.timedelta(
                    days=expires_days
                )

            new_key = AccessKey(
                key=key_val, description=description, expires_at=expires_at
            )
            db.session.add(new_key)
            db.session.commit()
            logging.info(
                f"Generated access key: {_key_ref(key_val)} with description '{description}' and expires_at {expires_at}"
            )
            return key_val
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error generating access key: {e}", exc_info=True)
            raise

    def validate_access_key(self, key_val: str) -> Tuple[bool, str]:
        logging.info(f"Validating access key: {_key_ref(key_val)}")
        key_data = AccessKey.query.filter_by(key=key_val).first()
        logging.info(f"Access key data found: {key_data is not None}")
        if key_data:
            logging.info(
                f"Access key {_key_ref(key_val)} active: {key_data.is_active}, expires: {key_data.expires_at}"
            )

        if not key_data:
            logging.warning(f"Access key {_key_ref(key_val)} not found.")
            return False, "Nieprawidłowy klucz dostępu"

        if not key_data.is_active:
            logging.warning(f"Access key {_key_ref(key_val)} is inactive.")
            return False, "Klucz dostępu został dezaktywowany"

        if key_data.expires_at:
            if _utc_naive_now() > key_data.expires_at:
                key_data.is_active = False
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    logging.error(
                        f"Error deactivating expired key {_key_ref(key_val)}: {e}", exc_info=True
                    )
                logging.warning(f"Access key {_key_ref(key_val)} has expired.")
                return False, "Klucz dostępu wygasł"

        logging.info(f"Access key {_key_ref(key_val)} is valid.")
        return True, ""

    def use_access_key(self, key_val: str, commit: bool = True) -> bool:
        """
        Atomically marks an access key as used.
        Uses SELECT FOR UPDATE to prevent race conditions.
        Returns True if key was successfully used, False otherwise.
        """
        try:
            bind = db.session.get_bind()
            dialect_name = bind.dialect.name if bind is not None else ""
            if dialect_name == "sqlite":
                key_data = db.session.get(AccessKey, key_val)
            else:
                # Use SELECT FOR UPDATE to lock the row and prevent race conditions
                key_data = (
                    AccessKey.query
                    .filter_by(key=key_val)
                    .with_for_update()
                    .first()
                )
            
            if key_data and key_data.is_active:
                key_data.used_count += 1
                key_data.last_used = _utc_naive_now()
                key_data.is_active = False  # Deactivate after use
                if commit:
                    db.session.commit()
                logging.info(f"Access key {_key_ref(key_val)} marked as used and deactivated.")
                return True
            elif key_data and not key_data.is_active:
                if commit:
                    db.session.rollback()  # Release the lock
                logging.info(f"Access key {_key_ref(key_val)} is already inactive. Not incrementing usage.")
                return False
            else:
                logging.warning(f"Access key {_key_ref(key_val)} not found for usage attempt.")
                return False
        except Exception as e:
            if commit:
                db.session.rollback()
            logging.error(f"Error using access key {_key_ref(key_val)}: {e}", exc_info=True)
            raise

    def deactivate_access_key(self, key_val: str) -> bool:
        try:
            key_data = AccessKey.query.filter_by(key=key_val).first()
            if key_data:
                if not key_data.is_active:
                    logging.info(f"Access key {_key_ref(key_val)} is already inactive. No action needed.")
                    return False
                key_data.is_active = False
                db.session.commit()
                logging.info(f"Access key {_key_ref(key_val)} deactivated.")
                return True
            logging.warning(f"Access key {_key_ref(key_val)} not found for deactivation attempt.")
            return False
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error deactivating access key {_key_ref(key_val)}: {e}", exc_info=True
            )
            return False

    def delete_access_key(self, key_val: str) -> bool:
        try:
            key_data = AccessKey.query.filter_by(key=key_val).first()
            if key_data:
                db.session.delete(key_data)
                db.session.commit()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error deleting access key {_key_ref(key_val)}: {e}", exc_info=True)
            return False

    def get_all_access_keys(self) -> List[AccessKey]:
        return AccessKey.query.order_by(desc(AccessKey.created_at)).all()


class AnnouncementService:
    """Manages all operations related to announcements using SQLAlchemy."""

    def create_announcement(
        self,
        title: str,
        message: str,
        type: str,
        expires_at: Optional[datetime.datetime],
    ) -> bool:
        try:
            # Convert ISO format string to datetime object if it's a string
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.datetime.fromisoformat(expires_at)
                except ValueError:
                    logging.error(f"Invalid ISO format for expires_at: {expires_at}")
                    return False # Or raise an exception, depending on desired error handling

            new_announcement = Announcement(
                title=title,
                message=message,
                type=type,
                expires_at=expires_at,
            )
            db.session.add(new_announcement)
            db.session.commit()
            return True
        except Exception as e:
            logging.error(f"Error creating announcement: {e}")
            db.session.rollback()
            return False

    def get_active_announcements(self) -> List[Announcement]:
        now = _utc_naive_now()
        return (
            Announcement.query.filter(
                Announcement.is_active,
                (Announcement.expires_at.is_(None)) | (Announcement.expires_at > now),  # type: ignore[attr-defined, operator]
            )
            .order_by(desc(Announcement.created_at))
            .all()
        )

    def deactivate_announcement(self, announcement_id: int) -> bool:
        try:
            announcement = db.session.get(Announcement, announcement_id)
            if announcement:
                announcement.is_active = False
                db.session.commit()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error deactivating announcement {announcement_id}: {e}", exc_info=True
            )
            return False

    def get_all_announcements(self) -> List[Announcement]:
        return Announcement.query.order_by(desc(Announcement.created_at)).all()


class StatisticsService:
    """Handles fetching statistics and file metadata using SQLAlchemy."""

    def get_user_files(self, username: str) -> List[File]:
        return (
            File.query.filter_by(user_username=username)
            .order_by(desc(File.modified_at))  # type: ignore[arg-type]
            .all()
        )

    def get_all_users_with_stats(self, page=1, per_page=10, excluded_usernames=None) -> Dict[str, Any]:
        # Clamp pagination inputs: a per_page of 0 would raise ZeroDivisionError
        # below, and negative values would produce a negative OFFSET. Inputs may
        # come straight from untrusted query-string parameters.
        try:
            page = max(1, int(page))
        except (TypeError, ValueError):
            page = 1
        try:
            per_page = min(max(1, int(per_page)), 200)
        except (TypeError, ValueError):
            per_page = 10
        # Using a subquery to count files and sum sizes for performance
        # Type ignore: SQLAlchemy column attributes are dynamically generated
        file_stats = (
            db.session.query(  # type: ignore[call-overload, arg-type]
                File.user_username,  # type: ignore[arg-type]
                func.count(File.id).label("file_count"),
                func.sum(File.size).label("total_size"),
            )
            .group_by(File.user_username)
            .subquery()
        )

        # Left join User with the stats subquery
        query = (
            db.session.query(User, file_stats.c.file_count, file_stats.c.total_size)
            .outerjoin(file_stats, User.username == file_stats.c.user_username)
            .order_by(desc(User.last_login))
        )
        if excluded_usernames:
            query = query.filter(~User.username.in_(excluded_usernames))
        
        # Manual pagination for compatibility
        total = query.count()
        items = query.limit(per_page).offset((page - 1) * per_page).all()
        
        # Calculate pagination info
        total_pages = (total + per_page - 1) // per_page  # Ceiling division
        has_next = page < total_pages
        has_prev = page > 1

        # Format the results into a list of dictionaries
        users_with_stats = []
        for user, file_count, total_size in items:
            users_with_stats.append(
                {
                    "name": user.username,
                    "created_date": user.created_at,
                    "last_activity": user.last_login,
                    "file_count": file_count or 0,
                    "total_size": total_size or 0,
                }
            )

        return {
            "users": users_with_stats,
            "total_pages": total_pages,
            "current_page": page,
            "has_next": has_next,
            "has_prev": has_prev,
        }

    def get_overall_stats(self, excluded_usernames=None) -> Dict:
        users_query = db.session.query(func.count(User.username))  # type: ignore[arg-type]
        if excluded_usernames:
            users_query = users_query.filter(~User.username.in_(excluded_usernames))
        total_users = users_query.scalar()
        files_query = db.session.query(func.count(File.id), func.sum(File.size))
        if excluded_usernames:
            # Mirror the user-count exclusion so file totals don't count
            # admin/system accounts that are hidden from the stats elsewhere.
            files_query = files_query.filter(
                ~File.user_username.in_(excluded_usernames)
            )
        result = files_query.first()
        total_files = result[0] if result else 0
        total_size = result[1] if result else 0
        return {
            "total_users": total_users or 0,
            "total_files": total_files or 0,
            "total_size": total_size or 0,
        }

    def add_or_update_file(
        self, username: str, filename: str, filepath: str, size: int, file_hash: str
    ):
        try:
            file_record = File.query.filter_by(filepath=filepath).first()
            modified_at = _utc_naive_now()

            if file_record:
                # Update existing record
                file_record.size = size
                file_record.modified_at = modified_at
                file_record.file_hash = file_hash
            else:
                # Create new record
                file_record = File(
                    user_username=username,
                    filename=filename,
                    filepath=filepath,
                    size=size,
                    modified_at=modified_at,
                    file_hash=file_hash,
                )
                db.session.add(file_record)
            db.session.commit()
        except IntegrityError:
            # Concurrent submission inserted the same UNIQUE(filepath) first.
            # Recover by rolling back and applying our values as an update.
            db.session.rollback()
            try:
                file_record = File.query.filter_by(filepath=filepath).first()
                if file_record is not None:
                    file_record.size = size
                    file_record.modified_at = _utc_naive_now()
                    file_record.file_hash = file_hash
                    db.session.commit()
                    return
                # Row vanished again between rollback and refetch — re-raise.
                raise
            except Exception as e:
                db.session.rollback()
                logging.error(
                    f"Error reconciling concurrent file insert {filepath}: {e}",
                    exc_info=True,
                )
                raise
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error adding/updating file {filepath} in DB: {e}", exc_info=True
            )
            raise

    def delete_file(self, filepath: str):
        try:
            file_record = File.query.filter_by(filepath=filepath).first()
            if file_record:
                db.session.delete(file_record)
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error deleting file {filepath} from DB: {e}", exc_info=True)
            raise


class NotificationService:
    """Manages user notifications using SQLAlchemy."""

    def create_notification(self, user_id: str, message: str, commit: bool = True):
        try:
            new_notification = Notification(user_id=user_id, message=message)
            db.session.add(new_notification)
            if commit:
                db.session.commit()
        except Exception as e:
            if commit:
                db.session.rollback()
            logging.error(
                f"Error creating notification for user {user_id}: {e}", exc_info=True
            )
            raise

    def get_notifications(self, user_id: str) -> List[Dict]:
        notifications = (
            Notification.query.filter_by(user_id=user_id)
            .order_by(desc(Notification.created_at))
            .all()
        )
        return [
            {
                "id": n.id,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifications
        ]

    def mark_notification_as_read(
        self, notification_id: int, user_id: Optional[str] = None
    ) -> bool:
        try:
            query = Notification.query.filter_by(id=notification_id)
            if user_id is not None:
                query = query.filter_by(user_id=user_id)
            notification = query.first()
            if notification:
                notification.is_read = True
                db.session.commit()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"Error marking notification {notification_id} as read: {e}",
                exc_info=True,
            )
            raise


class ChatService:
    """Manages the global live chat."""

    MAX_HISTORY_LIMIT = 150

    def _normalize_limit(self, limit: int) -> int:
        return max(1, min(int(limit), self.MAX_HISTORY_LIMIT))

    def create_message(self, user_id: str, message: str, commit: bool = True) -> ChatMessage:
        try:
            chat_message = ChatMessage(user_id=user_id, message=message)
            db.session.add(chat_message)
            if commit:
                db.session.commit()
                db.session.refresh(chat_message)
            return chat_message
        except Exception as e:
            if commit:
                db.session.rollback()
            logging.error(
                f"Error creating chat message for user {user_id}: {e}",
                exc_info=True,
            )
            raise

    def get_recent_messages(self, limit: int = MAX_HISTORY_LIMIT) -> List[ChatMessage]:
        normalized_limit = self._normalize_limit(limit)
        messages = (
            ChatMessage.query.order_by(desc(ChatMessage.id))
            .limit(normalized_limit)
            .all()
        )
        return list(reversed(messages))

    def get_messages_after(self, after_id: int, limit: int = MAX_HISTORY_LIMIT) -> List[ChatMessage]:
        normalized_limit = self._normalize_limit(limit)
        return (
            ChatMessage.query.filter(ChatMessage.id > after_id)
            .order_by(ChatMessage.id.asc())
            .limit(normalized_limit)
            .all()
        )

    def get_last_message_id(self) -> int:
        last_id = db.session.query(func.max(ChatMessage.id)).scalar()
        return int(last_id or 0)

    def get_unread_count(self, user_id: str) -> int:
        user = db.session.get(User, user_id)
        if user is None:
            return 0

        seen_id = int(user.last_global_chat_seen_id or 0)
        return (
            ChatMessage.query.filter(
                ChatMessage.id > seen_id,
                ChatMessage.user_id != user_id,
            ).count()
        )

    def mark_read(self, user_id: str, last_seen_id: int, commit: bool = True) -> int:
        user = db.session.get(User, user_id)
        if user is None:
            return 0

        target_seen_id = max(int(user.last_global_chat_seen_id or 0), max(0, int(last_seen_id)))
        user.last_global_chat_seen_id = target_seen_id or None

        try:
            if commit:
                db.session.commit()
        except Exception as e:
            if commit:
                db.session.rollback()
            logging.error(
                f"Error marking global chat as read for user {user_id}: {e}",
                exc_info=True,
            )
            raise

        return self.get_unread_count(user_id)
