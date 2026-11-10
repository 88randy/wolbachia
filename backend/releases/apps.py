from django.apps import AppConfig


class ReleasesConfig(AppConfig):
    name = "releases"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from releases.handlers import register_release_handler
        from releases.producers import register_permit_producer

        register_release_handler()
        register_permit_producer()
