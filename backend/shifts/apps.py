from django.apps import AppConfig


class ShiftsConfig(AppConfig):
    name = "shifts"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from shifts.handlers import register_shift_handlers

        register_shift_handlers()
