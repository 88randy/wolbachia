from django.apps import AppConfig


class FieldSyncConfig(AppConfig):
    name = "field_sync"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Registers the built-in handlers; every epic registers its own from its `ready()`.
        from field_sync.handlers.void import register_void_handler

        register_void_handler()
