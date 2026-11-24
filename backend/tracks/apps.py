from django.apps import AppConfig


class TracksConfig(AppConfig):
    name = "tracks"

    def ready(self) -> None:
        from tracks.handlers import register_track_handlers

        register_track_handlers()
