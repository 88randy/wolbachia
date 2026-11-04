"""Loads the optional, git-ignored `backend/.env` file. Real environment variables win."""

import os
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
READ_DOT_ENV_VARIABLE = "DJANGO_READ_DOT_ENV_FILE"
TRUTHY = {"1", "true", "yes", "on"}


def load_dotenv() -> None:
    """Idempotent. Skipped when `DJANGO_READ_DOT_ENV_FILE` is false (the prod default)."""
    if os.environ.get(READ_DOT_ENV_VARIABLE, "true").lower() in TRUTHY:
        environ.Env.read_env(BASE_DIR / ".env", overwrite=False)
