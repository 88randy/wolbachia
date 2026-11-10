"""Database boundary for tenant-coherent files and closed disclosure evidence."""

from types import SimpleNamespace

import pytest
from django.db import DatabaseError, connection, transaction

from accounts.models import AccessLog, Personnel
from geography.models import Quadrant
from organizations.models import Center
from tests.factories import MembershipFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def context():
    organization = OrganizationFactory()
    foreign_org = OrganizationFactory()
    actor = UserFactory()
    MembershipFactory(user=actor, organization=organization)
    foreign = MembershipFactory(organization=foreign_org)
    member = MembershipFactory(organization=organization)
    center = Center.objects.create(
        organization=organization, created_by=actor, code="SYNTHETIC", name="Synthetic center"
    )
    foreign_center = Center.objects.create(
        organization=foreign_org,
        created_by=foreign.user,
        code="FOREIGN",
        name="Synthetic foreign center",
    )
    other_center = Center.objects.create(
        organization=organization, created_by=actor, code="OTHER", name="Synthetic other center"
    )
    wrong_quadrant = Quadrant.objects.create(
        organization=organization, created_by=actor, center=other_center, code="WRONG"
    )
    person = Personnel.objects.create(
        organization=organization,
        created_by=actor,
        membership=member,
        center=center,
        display_name="Synthetic employee",
    )
    return SimpleNamespace(
        organization=organization,
        foreign=foreign,
        actor=actor,
        center=center,
        foreign_center=foreign_center,
        wrong_quadrant=wrong_quadrant,
        person=person,
    )


@pytest.mark.parametrize("relation", ["membership", "created_by", "center", "quadrant"])
def test_personnel_insert_refuses_foreign_relations_and_mismatched_quadrant(context, relation):
    fields = {
        "organization": context.organization,
        "created_by": context.actor,
        "membership": MembershipFactory(organization=context.organization),
        "center": context.center,
        "display_name": "Synthetic rejected employee",
    }
    invalid = {
        "membership": context.foreign,
        "created_by": context.foreign.user,
        "center": context.foreign_center,
        "quadrant": context.wrong_quadrant,
    }
    fields[relation] = invalid[relation]

    with pytest.raises(DatabaseError, match="mismatch"), transaction.atomic():
        Personnel.objects.create(**fields)


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("rfc_ciphertext", b"partial-envelope"),
        ("rfc_nonce", b"short"),
        ("rfc_wrapped_key", b"partial-wrapped-envelope"),
        ("rfc_fingerprint", "invalid-synthetic-fingerprint"),
    ],
)
def test_raw_personnel_update_refuses_partial_rfc_envelope(context, column, value):
    statements = {
        "rfc_ciphertext": "UPDATE accounts_personnel SET rfc_ciphertext=%s, revision=revision+1 WHERE id=%s",
        "rfc_nonce": "UPDATE accounts_personnel SET rfc_nonce=%s, revision=revision+1 WHERE id=%s",
        "rfc_wrapped_key": "UPDATE accounts_personnel SET rfc_wrapped_key=%s, revision=revision+1 WHERE id=%s",
        "rfc_fingerprint": "UPDATE accounts_personnel SET rfc_fingerprint=%s, revision=revision+1 WHERE id=%s",
    }
    with (
        pytest.raises(DatabaseError, match="RFC envelope incomplete"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(statements[column], [value, context.person.pk])


@pytest.mark.parametrize(
    "changes",
    [
        {"action": "synthetic-request-text"},
        {"origin": "request_path"},
        {"result": "synthetic-user-content"},
        {"revision": 2},
    ],
)
def test_receipts_refuse_open_text_and_stale_target_revision(context, changes):
    fields = {
        "organization": context.organization,
        "created_by": context.actor,
        "target": context.person,
        "center": context.center,
        "action": AccessLog.Action.REVEAL_RFC,
        "origin": AccessLog.Origin.WEB,
        "revision": context.person.revision,
        **changes,
    }

    with pytest.raises(DatabaseError, match="mismatch"), transaction.atomic():
        AccessLog.objects.create(**fields)


@pytest.mark.parametrize("relation", ["created_by", "center", "quadrant", "organization"])
def test_receipt_context_and_actor_cannot_cross_tenants(context, relation):
    invalid = {
        "created_by": context.foreign.user,
        "center": context.foreign_center,
        "quadrant": context.wrong_quadrant,
        "organization": context.foreign.organization,
    }
    fields = {
        "organization": context.organization,
        "created_by": context.actor,
        "target": context.person,
        "center": context.center,
        "action": AccessLog.Action.REVEAL_RFC,
        "origin": AccessLog.Origin.WEB,
        "revision": context.person.revision,
        relation: invalid[relation],
    }

    with pytest.raises(DatabaseError, match="mismatch"), transaction.atomic():
        AccessLog.objects.create(**fields)
