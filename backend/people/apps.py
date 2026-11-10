from django.apps import AppConfig
from django.core.exceptions import ImproperlyConfigured


class PeopleConfig(AppConfig):
    name = "people"

    def ready(self) -> None:
        from field_sync.producers import PRODUCERS, BundleProducer, register
        from people.projections import build_eligibility
        from people.serializers import EligibilityBundleSerializer

        prior = PRODUCERS.get("eligibility")
        if prior is None:
            register(
                BundleProducer("eligibility", 1, build_eligibility, EligibilityBundleSerializer)
            )
        elif prior.build is not build_eligibility:
            raise ImproperlyConfigured("Eligibility already has another producer owner.")
