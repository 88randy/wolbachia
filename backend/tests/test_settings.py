"""Production settings are safe by default and `check --deploy` stays clean."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

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
    "EMAIL_URL": "smtp://mailer:pw@smtp.example.test:587",
    "DEFAULT_FROM_EMAIL": "Wolbachia <no-reply@example.test>",
    "WEB_BASE_URL": "https://app.example.test",
    "DRF_NUM_PROXIES": "1",
}


def run_python(code: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return run_process([sys.executable, "-c", code], env)


def run_manage(*args: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return run_process([sys.executable, "manage.py", *args], env)


def run_process(command: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    base_env = {key: value for key, value in os.environ.items() if key in {"PATH", "SYSTEMROOT"}}
    return subprocess.run(
        command,
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


ENTRYPOINT_CHECK = (
    "import importlib, os; importlib.import_module('{module}'); "
    "from django.conf import settings as s; "
    "print(os.environ['DJANGO_SETTINGS_MODULE'], s.DEBUG)"
)


@pytest.mark.parametrize("module", ["config.wsgi", "config.asgi", "config.celery"])
def test_entrypoints_default_to_prod_settings_without_the_settings_variable(module: str) -> None:
    env = {k: v for k, v in PROD_ENV.items() if k != "DJANGO_SETTINGS_MODULE"}

    result = run_python(ENTRYPOINT_CHECK.format(module=module), env=env)

    assert result.stdout.strip() == "config.settings.prod False", result.stderr


def test_prod_does_not_read_the_local_env_file_by_default() -> None:
    env = {k: v for k, v in PROD_ENV.items() if k != "DJANGO_READ_DOT_ENV_FILE"}
    code = "import os, config.settings.prod; print(os.environ['DJANGO_READ_DOT_ENV_FILE'])"

    result = run_python(code, env=env)

    assert result.stdout.strip() == "false", result.stderr


def test_test_settings_load_without_any_environment_variable() -> None:
    env = {"DJANGO_READ_DOT_ENV_FILE": "false", "DJANGO_SETTINGS_MODULE": "config.settings.test"}

    result = run_manage("check", env=env)

    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("variable", ["EMAIL_URL", "DEFAULT_FROM_EMAIL", "WEB_BASE_URL"])
def test_prod_settings_require_the_password_reset_email_variables(variable: str) -> None:
    env = {key: value for key, value in PROD_ENV.items() if key != variable}

    result = run_manage("check", env=env)

    assert result.returncode != 0
    assert variable in result.stderr


def test_prod_email_settings_come_from_the_environment() -> None:
    result = run_manage(
        "shell",
        "--no-imports",
        "-c",
        "from django.conf import settings as s; "
        "print(s.EMAIL_BACKEND, s.EMAIL_HOST, s.EMAIL_PORT, s.WEB_BASE_URL)",
        env=PROD_ENV,
    )

    expected = "django.core.mail.backends.smtp.EmailBackend smtp.example.test 587"
    assert result.stdout.strip() == f"{expected} https://app.example.test"


def test_dev_defaults_print_emails_to_the_console() -> None:
    env = {
        "DJANGO_READ_DOT_ENV_FILE": "false",
        "DJANGO_SETTINGS_MODULE": "config.settings.test",
    }

    result = run_manage(
        "shell",
        "--no-imports",
        "-c",
        "from django.conf import settings as s; print(s.EMAIL_BACKEND, s.WEB_BASE_URL)",
        env=env,
    )

    assert result.stdout.strip() == (
        "django.core.mail.backends.console.EmailBackend http://localhost:5173"
    )


def test_prod_requires_the_number_of_proxies() -> None:
    env = {key: value for key, value in PROD_ENV.items() if key != "DRF_NUM_PROXIES"}

    result = run_manage("check", env=env)

    assert result.returncode != 0
    assert "DRF_NUM_PROXIES" in result.stderr


def test_prod_uses_the_configured_number_of_proxies() -> None:
    result = run_manage(
        "shell",
        "--no-imports",
        "-c",
        "from django.conf import settings as s; print(s.REST_FRAMEWORK['NUM_PROXIES'])",
        env={**PROD_ENV, "DRF_NUM_PROXIES": "2"},
    )

    assert result.stdout.strip() == "2"


def test_prod_refuses_a_web_base_url_that_is_not_https() -> None:
    result = run_manage("check", env={**PROD_ENV, "WEB_BASE_URL": "http://app.example.test"})

    assert result.returncode != 0
    assert "WEB_BASE_URL" in result.stderr


def test_atomic_requests_stay_off() -> None:
    """Revocations commit before the error is raised; an outer transaction would undo them."""
    from django.conf import settings

    assert not settings.DATABASES["default"].get("ATOMIC_REQUESTS", False)
