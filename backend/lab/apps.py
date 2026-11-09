"""Register Lab as an isolated append-only domain, not a field sync event handler."""

from django.apps import AppConfig


class LabConfig(AppConfig):
    name = "lab"
