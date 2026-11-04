"""Rate limit of `/field/sync/`: per device, so one noisy phone never blocks another."""

from rest_framework.request import Request
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from accounts.models import DeviceSession


class FieldSyncDeviceThrottle(SimpleRateThrottle):
    """Keyed by the device of the session (not the IP, not the user): a phone shared by two
    couriers shares one budget, two phones of one courier have one each. The rate is the env
    setting `THROTTLE_FIELD_SYNC_RATE` (scope `field_sync`)."""

    scope = "field_sync"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        session = request.auth
        if not isinstance(session, DeviceSession):
            return None  # not a device session: authentication already refused the request
        return self.cache_format % {"scope": self.scope, "ident": str(session.device_id)}
