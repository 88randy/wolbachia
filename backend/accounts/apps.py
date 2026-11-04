from importlib import import_module

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "accounts"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Registers the OpenAPI extension for the bearer authentication class.
        import_module("accounts.schema")
