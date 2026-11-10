"""Settings shared by every environment.

Environment-specific modules (dev, test, prod) import everything from here. Values come from
environment variables (django-environ); see `backend/.env.example` for the full list.
"""

import environ
from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured

from ._env import BASE_DIR, load_dotenv

load_dotenv()  # optional backend/.env (untracked); real environment variables always win
env = environ.Env()

# External key identities only; credentials come from the deployment's AWS identity.
# Missing configuration leaves protected RFC operations unavailable.
RFC_KMS_KEY_ID = env("RFC_KMS_KEY_ID", default="")
RFC_KMS_HMAC_KEY_ID = env("RFC_KMS_HMAC_KEY_ID", default="")
RFC_KMS_REGION = env("RFC_KMS_REGION", default="")

DEBUG = False

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "drf_spectacular",
    "accounts",
    "core",
    "organizations",
    "catalogs",
    "rules",
    "field_sync",
    "uploads",
    "reviews",
    "shifts",
    "geography.apps.GeographyConfig",
    "fleet",
    "ovitraps",
    "scheduling",
    "incidents.apps.IncidentsConfig",
    "inventory",
    "lab.apps.LabConfig",
    "community.apps.CommunityConfig",
    "people.apps.PeopleConfig",
    "privacy.apps.PrivacyConfig",
    "releases.apps.ReleasesConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.session_identity.SessionIdentityMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_USER_MODEL = "accounts.User"

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
UPLOADS_PRIVATE_ROOT = BASE_DIR / "private_uploads"

# Cookies: the web uses the Django session cookie + CSRF token (decision 9).
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# API defaults (documented in backend/README.md).
API_PAGE_SIZE = env.int("API_PAGE_SIZE", default=50)
API_CURSOR_PAGE_SIZE = env.int("API_CURSOR_PAGE_SIZE", default=100)
THROTTLE_ANON_RATE = env("THROTTLE_ANON_RATE", default="60/min")
THROTTLE_USER_RATE = env("THROTTLE_USER_RATE", default="600/min")
THROTTLE_RFC_REVEAL_RATE = env("THROTTLE_RFC_REVEAL_RATE", default="30/hour")
THROTTLE_RFC_WRITE_RATE = env("THROTTLE_RFC_WRITE_RATE", default="10/hour")

# Authentication (#4). Token lifetimes, grace windows and lockout thresholds are global (the
# organization is unknown before login), env-configurable defaults [PENDING client].
AUTH_ACCESS_TOKEN_TTL_SECONDS = env.int("AUTH_ACCESS_TOKEN_TTL_SECONDS", default=900)
AUTH_REFRESH_TOKEN_TTL_DAYS = env.int("AUTH_REFRESH_TOKEN_TTL_DAYS", default=30)  # idle, slides
# Security metadata retention (#54): invalid configuration must fail before a worker starts.
try:
    AUTH_TOKEN_PAIR_RETENTION_DAYS = env.int("AUTH_TOKEN_PAIR_RETENTION_DAYS", default=90)
except ValueError as error:
    raise ImproperlyConfigured(
        "AUTH_TOKEN_PAIR_RETENTION_DAYS must be an integer (30..365)."
    ) from error
if not 30 <= AUTH_TOKEN_PAIR_RETENTION_DAYS <= 365:
    raise ImproperlyConfigured("AUTH_TOKEN_PAIR_RETENTION_DAYS must be between 30 and 365.")
try:
    AUTH_SESSION_AUDIT_RETENTION_DAYS = env.int("AUTH_SESSION_AUDIT_RETENTION_DAYS", default=365)
except ValueError as error:
    raise ImproperlyConfigured("AUTH_SESSION_AUDIT_RETENTION_DAYS must be an integer.") from error
if max(180, AUTH_TOKEN_PAIR_RETENTION_DAYS) > AUTH_SESSION_AUDIT_RETENTION_DAYS:
    raise ImproperlyConfigured(
        "AUTH_SESSION_AUDIT_RETENTION_DAYS must be >=180 and >=AUTH_TOKEN_PAIR_RETENTION_DAYS."
    )
AUTH_REFRESH_REUSE_GRACE_SECONDS = env.int("AUTH_REFRESH_REUSE_GRACE_SECONDS", default=60)
AUTH_REVOKED_FINAL_UPLOAD_HOURS = env.int("AUTH_REVOKED_FINAL_UPLOAD_HOURS", default=72)  # 0 = off
AUTH_LOGIN_MAX_FAILURES = env.int("AUTH_LOGIN_MAX_FAILURES", default=5)
AUTH_LOGIN_LOCKOUT_MINUTES = env.int("AUTH_LOGIN_LOCKOUT_MINUTES", default=15)
AUTH_WEB_SESSION_AGE_SECONDS = env.int("AUTH_WEB_SESSION_AGE_SECONDS", default=43_200)  # 12 h
SESSION_COOKIE_AGE = AUTH_WEB_SESSION_AGE_SECONDS
PASSWORD_RESET_TIMEOUT = env.int("PASSWORD_RESET_TIMEOUT", default=3_600)
# Reset emails sent to one address per hour, whatever the requesting IPs (mail-bombing guard).
AUTH_PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR = env.int(
    "AUTH_PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR", default=3
)

# Password reset email. `EMAIL_URL` is a django-environ URL (`consolemail://` prints to the
# console, `smtp://user:pass@host:587`...); production requires it explicitly (see prod.py).
globals().update(env.email_url("EMAIL_URL", default="consolemail://"))
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Wolbachia <no-reply@localhost>")
WEB_BASE_URL = env("WEB_BASE_URL", default="http://localhost:5173").rstrip("/")  # [ASSUMPTION]
WEB_PASSWORD_RESET_PATH = env("WEB_PASSWORD_RESET_PATH", default="/reset-password")  # [ASSUMPTION]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {},
    }
]

THROTTLE_LOGIN_USER_IP_RATE = env("THROTTLE_LOGIN_USER_IP_RATE", default="10/min")
THROTTLE_LOGIN_IP_RATE = env("THROTTLE_LOGIN_IP_RATE", default="30/min")
THROTTLE_REFRESH_RATE = env("THROTTLE_REFRESH_RATE", default="30/min")
THROTTLE_PASSWORD_RESET_RATE = env("THROTTLE_PASSWORD_RESET_RATE", default="5/hour")
THROTTLE_PASSWORD_RESET_CONFIRM_RATE = env(
    "THROTTLE_PASSWORD_RESET_CONFIRM_RATE", default="20/hour"
)

# Field sync (#5): technical limits, not business rules, so they are env settings and not rule
# parameters. [ASSUMPTION] values, to be tuned with real batches from the field test (#13).
THROTTLE_FIELD_SYNC_RATE = env("THROTTLE_FIELD_SYNC_RATE", default="60/min")  # per device
SYNC_MAX_BODY_BYTES = env.int("SYNC_MAX_BODY_BYTES", default=1_048_576)  # 1 MB
SYNC_MAX_EVENTS = env.int("SYNC_MAX_EVENTS", default=200)
SYNC_MAX_EVENT_PAYLOAD_BYTES = env.int("SYNC_MAX_EVENT_PAYLOAD_BYTES", default=16_384)  # 16 KB
SYNC_CURSOR_MAX_AGE_SECONDS = env.int("SYNC_CURSOR_MAX_AGE_SECONDS", default=2_592_000)  # 30 days
SYNC_LOCK_TIMEOUT_MS = env.int("SYNC_LOCK_TIMEOUT_MS", default=3_000)
SYNC_MAX_FANOUT_COURIERS = env.int("SYNC_MAX_FANOUT_COURIERS", default=1000)
if SYNC_MAX_FANOUT_COURIERS < 1:
    raise ImproperlyConfigured("SYNC_MAX_FANOUT_COURIERS must be positive.")
SYNC_RETRY_AFTER_SECONDS = env.int("SYNC_RETRY_AFTER_SECONDS", default=2)

# SA09 / #56: deployment limits, validated at startup rather than silently clamped.
try:
    SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY = env.int(
        "SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY", default=1000
    )
except ValueError as error:
    raise ImproperlyConfigured(
        "SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY must be an integer."
    ) from error
if not 100 <= SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY <= 10000:
    raise ImproperlyConfigured("SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY must be within 100..10000.")
try:
    SYNC_REJECTION_ALERT_PERCENTS = sorted(
        set(env.list("SYNC_REJECTION_ALERT_PERCENTS", cast=int, default=[80, 100]))
    )
except ValueError as error:
    raise ImproperlyConfigured(
        "SYNC_REJECTION_ALERT_PERCENTS must be a list of integers."
    ) from error
if not SYNC_REJECTION_ALERT_PERCENTS or any(
    not 1 <= percent <= 100 for percent in SYNC_REJECTION_ALERT_PERCENTS
):
    raise ImproperlyConfigured("SYNC_REJECTION_ALERT_PERCENTS must contain integers within 1..100.")

# Void reasons (#32): minimum characters after trimming, shared by every void path and sent to
# the web in `GET /me/` (`limits`). Owner delegated the value to the orchestrator (2026-11-04).
VOID_REASON_MIN_LENGTH = env.int("VOID_REASON_MIN_LENGTH", default=10)

REST_FRAMEWORK = {
    # Session first: it sends the `WWW-Authenticate: Session` challenge that keeps 401s as 401.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.ApiSessionAuthentication",
        "accounts.authentication.DeviceBearerAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": THROTTLE_ANON_RATE,
        "user": THROTTLE_USER_RATE,
        "rfc_reveal": THROTTLE_RFC_REVEAL_RATE,
        "rfc_write": THROTTLE_RFC_WRITE_RATE,
        "login_user_ip": THROTTLE_LOGIN_USER_IP_RATE,
        "login_ip": THROTTLE_LOGIN_IP_RATE,
        "refresh": THROTTLE_REFRESH_RATE,
        "password_reset": THROTTLE_PASSWORD_RESET_RATE,
        "password_reset_confirm": THROTTLE_PASSWORD_RESET_CONFIRM_RATE,
        "field_sync": THROTTLE_FIELD_SYNC_RATE,
        "risk_import_upload": env("THROTTLE_RISK_IMPORT_UPLOAD_RATE", default="10/hour"),
    },
    # Number of trusted reverse proxies in front of the API. 0 ignores X-Forwarded-For, so a
    # client cannot dodge the anonymous throttle by rotating that header.
    "NUM_PROXIES": env.int("DRF_NUM_PROXIES", default=0),
    "EXCEPTION_HANDLER": "core.exception_handler.api_exception_handler",
    # `?code=` on list endpoints; a viewset opts in with `code_lookup_field = "code"`.
    "DEFAULT_FILTER_BACKENDS": ["core.filters.CodeLookupFilter"],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": API_PAGE_SIZE,
    "DEFAULT_SCHEMA_CLASS": "core.schema.ApiAutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Wolbachia field API",
    "DESCRIPTION": "Single API for the mobile app and the web (see docs/api-conventions.md).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAuthenticated"],
    "COMPONENT_SPLIT_REQUEST": True,
    # Names the sync enums explicitly so the older `StatusEnum` (rule versions) keeps its name.
    "ENUM_NAME_OVERRIDES": {
        "ReleaseDeviceStatusEnum": ["active", "inactive", "retired"],
        "OutcomeEnum": ["recovered_later", "written_off"],
        "EvaluationOutcomeEnum": ["incomplete", "pass", "low", "critical_failure"],
        "ResourceTypeEnum": ["quadrant", "block"],
        "EligibilityResourceTypeEnum": ["training_eligibility"],
        "ModeEnum": ["none", "selected", "all"],
        "OriginEnum": [
            "field_event",
            "direct_report",
            "review_decision",
            "inventory_condition",
            "lab_reception",
            "unknown",
        ],
        "ReviewDecisionActionEnum": ["accept", "void", "open_incident"],
        "RelocationDecisionEnum": ["approved", "rejected"],
        "DecisionEnum": ["keep", "move", "remove"],
        "ReviewDecisionStateEnum": ["pending", "accepted", "voided"],
        "ShiftValidationKindEnum": ["approve", "observe"],
        "CourierHistoryKindEnum": ["review_decision", "shift_validation"],
        "CourierHistoryDecisionKindEnum": ["accept", "void", "open_incident", "approve", "observe"],
        "CourierHistoryDecisionStateEnum": [
            "pending",
            "accepted",
            "voided",
            "approved",
            "observed",
        ],
        "CourierHistoryEffectStateEnum": [
            "applied_review",
            "adopted_legacy",
            "discarded",
            "incident_open",
            "approved",
            "observed",
        ],
        "ReviewEffectModeEnum": ["applied_review", "adopted_legacy"],
        "LegacyEffectStateEnum": ["none", "complete_owned", "partial", "ambiguous", "unavailable"],
        "InventoryLocationKindEnum": ["biofactory", "warehouse", "center"],
        "InventoryLotStatusEnum": ["draft", "available", "blocked"],
        "IncidentStateEnum": ["open", "closed", "voided"],
        "StateEnum": ["authorized", "received", "verified"],
        "CourierChangeActionEnum": ["upsert", "remove"],
        "ProjectionUpsertActionEnum": ["upsert"],
        "EventStatusEnum": "field_sync.models.EventStatus",
        "ReviewKindEnum": "reviews.models.ReviewKind",
        "ShiftStatusEnum": "shifts.models.ShiftStatus",
        "CheckResultEnum": "shifts.models.CheckResult",
        "ServiceKindEnum": "fleet.models.ServiceKind",
        "StatusEnum": "rules.selectors.VERSION_STATUSES",
        "OvitrapLifecycleStatusEnum": ["active", "voided"],
        "OvitrapStatusFilterEnum": ["active", "voided", "all"],
    },
    # The enum hook is spectacular's default; ours adds ErrorEnvelope and the `default` error
    # response to every operation (packages/api-client types errors from it).
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "core.schema.add_error_envelope",
    ],
}

CELERY_BROKER_URL = REDIS_URL
CELERY_TASK_TRACK_STARTED = True
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULE = {
    "maintain-training-notices": {
        "task": "people.tasks.maintain_training_notices",
        "schedule": 300.0,
    },
    "recover-lab-reception-incidents": {
        "task": "lab.tasks.recover_reception_incidents",
        "schedule": 60.0,
    },
    "close-lab-local-days": {
        "task": "lab.tasks.close_due_lab_days",
        "schedule": crontab(minute=10),
    },
    "recover-condition-incidents": {
        "task": "inventory.tasks.recover_condition_incidents",
        "schedule": 60.0,
    },
    "maintain-scoped-incidents": {
        "task": "incidents.tasks.maintain_incidents",
        "schedule": crontab(minute="*"),
    },
    "prune-ended-token-pairs": {
        "task": "accounts.tasks.prune_ended_token_pairs",
        "schedule": crontab(hour=3, minute=30),
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
}
