"""Permission codes of the privacy and regulatory screens (W57-W60, W69-W71 settings)."""

TRANSFER_AUTHORIZATION_READ = "transfer_authorization.read"
TRANSFER_AUTHORIZATION_MANAGE = "transfer_authorization.manage"
EXPORT_RUN = "export.run"
ARCO_READ = "arco_request.read"
ARCO_MANAGE = "arco_request.manage"
PORTAL_MANAGE = "portal.manage"
API_KEY_READ = "api_key.read"
API_KEY_MANAGE = "api_key.manage"

_PRIVACY_CODES = (
    TRANSFER_AUTHORIZATION_READ,
    TRANSFER_AUTHORIZATION_MANAGE,
    EXPORT_RUN,
    ARCO_READ,
    ARCO_MANAGE,
)
# `access_log.read` already belongs to the admin personnel codes.
REGULATORY_CODES = (*_PRIVACY_CODES, "access_log.read")
ADMIN_CODES = (*_PRIVACY_CODES, PORTAL_MANAGE, API_KEY_READ, API_KEY_MANAGE)
