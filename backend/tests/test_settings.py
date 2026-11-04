"""Production settings are safe by default and `check --deploy` stays clean."""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROD_SECRET = "prod-secret-" + "x7Qz9" * 12

PROD_ENV = {
    "DJANGO_READ_DOT_ENV_FILE": "false",  # a developer's local .env must not leak into the test
    "DJANGO_SETTINGS_MODULE": "config.settings.prod",
    "DJANGO_SECRET_KEY": PROD_SECRET,
    "DJANGO_ALLOWED_HOSTS": "api.example.test",
    "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.example.test",
    "DATABASE_URL": "postgres://user:pw@localhost:5432/db",
    "REDIS_URL": "redis://localhost:6379/0",
}


def run_manage(*args: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    base_env = {key: value for key, value in os.environ.items() if key in {"PATH", "SYSTEMROOT"}}
    return subprocess.run(
        [sys.executable, "manage.py", *args],
        cwd=BACKEND_DIR,
        env={**base_env, **env},
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


def test_check_deploy_has_no_warnings_with_prod_settings() -> None:
    result = run_manage("check", "--deploy", "--fail-level", "WARNING", env=PROD_ENV)

    assert result.returncode == 0, result.stderr


def test_prod_settings_fail_without_a_secret_key() -> None:
    env = {key: value for key, value in PROD_ENV.items() if key != "DJANGO_SECRET_KEY"}

    result = run_manage("check", env=env)

    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr


def test_prod_settings_fail_without_allowed_hosts() -> None:
    env = {key: value for key, value in PROD_ENV.items() if key != "DJANGO_ALLOWED_HOSTS"}

    result = run_manage("check", env=env)

    assert result.returncode != 0
    assert "DJANGO_ALLOWED_HOSTS" in result.stderr


def test_prod_session_and_csrf_cookies_are_secure() -> None:
    result = run_manage(
        "shell",
        "--no-imports",
        "-c",
        "from django.conf import settings as s; "
        "print(s.DEBUG, s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, "
        "s.SESSION_COOKIE_HTTPONLY, s.SESSION_COOKIE_SAMESITE)",
        env=PROD_ENV,
    )

    assert result.stdout.strip() == "False True True True Lax"
