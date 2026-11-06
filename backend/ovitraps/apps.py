from django.apps import AppConfig


class OvitrapsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ovitraps"

    def ready(self) -> None:
        from ovitraps.handlers import register_ovitrap_handlers
        from ovitraps.lifecycle.handlers import register_lifecycle_handlers
        from ovitraps.producers import register_ovitrap_producers

        register_ovitrap_handlers()
        register_lifecycle_handlers()
        register_ovitrap_producers()
