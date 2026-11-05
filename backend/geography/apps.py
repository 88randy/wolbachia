from django.apps import AppConfig


class GeographyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "geography"

    def ready(self) -> None:
        from geography.producers import register_geography_producers

        register_geography_producers()
