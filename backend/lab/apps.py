"""Register Lab's append-only domains and the sample collection source."""

from django.apps import AppConfig


class LabConfig(AppConfig):
    name = "lab"

    def ready(self) -> None:
        from lab.samples.handlers import register_sample_handler

        register_sample_handler()
