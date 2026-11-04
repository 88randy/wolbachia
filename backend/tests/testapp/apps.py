from django.apps import AppConfig


class TestAppConfig(AppConfig):
    """Test-only app (installed by config.settings.test): exercises the shared base classes."""

    name = "tests.testapp"
    label = "testapp"
    default_auto_field = "django.db.models.BigAutoField"
