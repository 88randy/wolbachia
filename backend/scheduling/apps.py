from django.apps import AppConfig


class SchedulingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scheduling"

    def ready(self) -> None:
        from field_sync.producers import BundleProducer, register
        from scheduling.courier_feed import AssignmentProducerSerializer, build

        register(BundleProducer("assignments", 2, build, AssignmentProducerSerializer))
