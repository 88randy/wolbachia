from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    name = "reviews"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from field_sync.history_producer import register_history_producer

        register_history_producer()
