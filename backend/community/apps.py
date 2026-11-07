from django.apps import AppConfig


class CommunityConfig(AppConfig):
    name = "community"

    def ready(self) -> None:
        from community.review import register_community_handler

        register_community_handler()
