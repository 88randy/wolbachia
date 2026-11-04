"""Password reset emails: the lookup, the link and the localized text.

The text lives in Django templates (`accounts/templates/accounts/email/`), one per locale, because
an email is not an API response: decision recorded in docs/decisions.md. The request endpoint only
enqueues `accounts.tasks.send_password_reset_email`; the lookup happens here, in the worker, so
the endpoint's work and timing are the same whether or not the address belongs to an account.
"""

import logging
import smtplib
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from accounts.audit import fingerprint
from accounts.models import User
from organizations.models import DEFAULT_LANGUAGE, Membership

logger = logging.getLogger("accounts.auth")

SECONDS_PER_HOUR = 3_600
SECONDS_PER_MINUTE = 60
ENGLISH_LOCALE = "en"
TEMPLATE_PREFIX = "accounts/email/password_reset"


def _allowed_for_address(email: str) -> bool:
    """At most N emails per address and hour, whatever the requesting IPs (mail-bombing guard).

    Trade-off: anyone who knows an address can use up its quota and delay the real owner's reset
    until the hour passes. The alternative, no cap, lets an attacker flood a victim's inbox.
    """
    key = f"auth_reset_mail:{fingerprint(email)}"
    cache.add(key, 0, timeout=SECONDS_PER_HOUR)
    try:
        sent = cache.incr(key)
    except ValueError:  # expired between `add` and `incr`
        cache.set(key, 1, timeout=SECONDS_PER_HOUR)
        sent = 1
    return sent <= settings.AUTH_PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR


def email_locale(user: User) -> str:
    """`en` when the user's first active organization works in English, else the default es-MX."""
    membership = (
        Membership.objects.filter(user=user, is_active=True, organization__is_active=True)
        .select_related("organization")
        .order_by("created_at")
        .first()
    )
    languages = membership.organization.languages if membership else []
    language = languages[0] if languages else DEFAULT_LANGUAGE
    return ENGLISH_LOCALE if language.lower().startswith(ENGLISH_LOCALE) else DEFAULT_LANGUAGE


def build_reset_url(user: User) -> str:
    """`<WEB_BASE_URL><path>#uid=<uid>&token=<token>`: the secret travels in the fragment.

    A browser never sends the fragment to a server, so the token stays out of every access log,
    proxy and `Referer` header between the email and the web page (issue #58).
    """
    fragment = urlencode(
        {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
        }
    )
    path = "/" + settings.WEB_PASSWORD_RESET_PATH.strip("/")
    return f"{settings.WEB_BASE_URL}{path}#{fragment}"


def _send_to(user: User) -> None:
    locale = email_locale(user)
    context = {
        "username": user.get_username(),
        "reset_url": build_reset_url(user),
        "valid_minutes": max(1, settings.PASSWORD_RESET_TIMEOUT // SECONDS_PER_MINUTE),
    }
    subject = render_to_string(f"{TEMPLATE_PREFIX}_subject.{locale}.txt", context)
    body = render_to_string(f"{TEMPLATE_PREFIX}_body.{locale}.txt", context)
    send_mail(
        " ".join(subject.split()),  # one line: a subject must not carry line breaks
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def send_password_reset_emails(email: str) -> int:
    """Email a reset link to every active user with that address; returns how many were sent.

    Sends nothing (and says nothing) for unknown or inactive addresses, and stops after a few
    emails per address and hour. Users created without a password are included on purpose: the
    reset link is how they set their first one [ASSUMPTION]. A delivery failure is logged with
    the user id only (never the address) and does not stop the other recipients.
    """
    normalized = email.strip().lower()
    if not normalized or not _allowed_for_address(normalized):
        return 0
    sent = 0
    for user in User.objects.filter(email__iexact=normalized, is_active=True):
        try:
            _send_to(user)
        except (smtplib.SMTPException, OSError) as error:
            # No traceback and no message: SMTP errors quote the recipient address.
            logger.error(  # noqa: TRY400
                "event=password_reset_email_failed user=%s error=%s", user.pk, type(error).__name__
            )
        else:
            sent += 1
    return sent
