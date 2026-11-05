"""Celery tasks of the accounts app. They only orchestrate services."""

from celery import shared_task

from accounts.reset_emails import send_password_reset_emails
from accounts.token_retention import prune_ended_token_pairs as prune_token_pairs


@shared_task(ignore_result=True)
def send_password_reset_email(email: str) -> None:
    """Look the address up and email a reset link to its active users (see `reset_emails`).

    The address travels as a task argument through the broker, so it is ephemeral and the broker
    must be a trusted internal service [ASSUMPTION]. Nothing is returned or stored.
    """
    send_password_reset_emails(email)


@shared_task(ignore_result=True)
def prune_ended_token_pairs() -> None:
    """Run the bounded token-family retention service (nightly, #54)."""
    prune_token_pairs()
