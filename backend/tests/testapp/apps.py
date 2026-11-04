from django.apps import AppConfig


class TestAppConfig(AppConfig):
    """Test-only app (installed by config.settings.test): exercises the shared base classes."""

    name = "tests.testapp"
    label = "testapp"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Test event types for the sync pipeline (like an epic would register its own).
        from tests.testapp.handlers import register_test_handlers

        register_test_handlers()
