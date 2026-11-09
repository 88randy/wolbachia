from django.apps import AppConfig


class InventoryConfig(AppConfig):
    name = "inventory"

    def ready(self) -> None:
        from inventory.allocations.handlers import register_supply_handlers
        from inventory.allocations.producers import register_supply_producer
        from inventory.transfers.handlers import register_transfer_handlers

        register_transfer_handlers()
        register_supply_handlers()
        register_supply_producer()
