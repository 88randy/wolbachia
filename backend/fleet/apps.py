from django.apps import AppConfig


class FleetConfig(AppConfig):
    name = "fleet"

    def ready(self) -> None:
        from fleet.handlers import register_fleet_handlers

        register_fleet_handlers()
