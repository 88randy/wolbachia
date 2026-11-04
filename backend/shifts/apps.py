from django.apps import AppConfig


class ShiftsConfig(AppConfig):
    name = "shifts"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from field_sync.registry import register_envelope_check
        from shifts.guard import check_event_shift
        from shifts.handlers import register_shift_handlers

        register_shift_handlers()
        register_envelope_check(check_event_shift)
