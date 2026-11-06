from django.apps import AppConfig


class IncidentsConfig(AppConfig):
    name = "incidents"

    def ready(self) -> None:
        from field_sync.registry import EventHandler, register
        from incidents.handlers import CODES, apply_incident
        from incidents.payloads import EmergencyAccidentPayload, IncidentReportPayload
        from incidents.review import IncidentReviewAdapter

        register(
            EventHandler(
                "incident.report",
                1,
                IncidentReportPayload,
                apply_incident,
                codes=CODES,
                review_adapter=IncidentReviewAdapter(),
            )
        )
        register(
            EventHandler(
                "emergency.accident",
                1,
                EmergencyAccidentPayload,
                apply_incident,
                codes=CODES,
                review_adapter=IncidentReviewAdapter(),
            )
        )
