from django.apps import AppConfig


class OvitrapsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ovitraps"

    def ready(self) -> None:
        from ovitraps.handlers import register_ovitrap_handlers

        register_ovitrap_handlers()
