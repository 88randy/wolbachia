"""Explicit grants for fleet test actors; production defaults continue to deny."""

from organizations.models import all_scope


def grant_fleet_scope(member):
    actor, membership = member
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = all_scope()
        profile.save(update_fields=["scope"])
    return actor, membership
