"""One-off helper: create (or reset) a normal test account for manual login.

Run with:  python _seed_account.py
Safe to re-run — resets the password if the account already exists.
"""
import app as A

USERNAME = "tester"
PASSWORD = "tester123"

with A.app.app_context():
    A.db.create_all()
    try:
        A.ensure_runtime_database_tables()
    except Exception as e:  # pragma: no cover - defensive
        print("warn: ensure_runtime_database_tables:", e)

    if A.auth_manager.get_user_by_id(USERNAME):
        ok, msg = A.auth_manager.reset_user_password(USERNAME, PASSWORD)
        print(f"[exists] password reset -> ok={ok} msg={msg}")
    else:
        key = A.access_key_service.generate_access_key(
            description="manual test account", expires_days=7
        )
        ok, msg, _token = A.auth_manager.register_user(
            USERNAME, PASSWORD, key, mark_tutorial_seen=True
        )
        print(f"[new] register -> ok={ok} msg={msg}")

    # A spare single-use-style access key in case you want to register more accounts.
    spare = A.access_key_service.generate_access_key(
        description="spare manual key", expires_days=7
    )
    print("----------------------------------------")
    print("LOGIN_USERNAME:", USERNAME)
    print("LOGIN_PASSWORD:", PASSWORD)
    print("SPARE_ACCESS_KEY:", spare)
    print("----------------------------------------")
