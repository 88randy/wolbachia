from django.apps import AppConfig


class InventoryConfig(AppConfig):
    name = "inventory"

    def ready(self) -> None:
        from inventory.transfers.handlers import register_transfer_handlers

        register_transfer_handlers()
