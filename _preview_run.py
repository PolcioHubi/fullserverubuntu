import os
os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("APP_ENV_MODE", "load_test")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")
import app as A
A.app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False, threaded=True)
