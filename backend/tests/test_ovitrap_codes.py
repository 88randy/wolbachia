"""Short human code of ovitraps (OVT-0001): allocation at placement, pre-registered labels and the
offline pool, lookup by code, backfill and per-organization uniqueness."""

from uuid import uuid4

import pytest
from django.db import DatabaseError, IntegrityError, connection, transaction

from organizations.code_backfill import BackfillTarget, backfill_codes
from organizations.codes import OVITRAP_CODE
from organizations.models import CodeCounter
from ovitraps.labels import code_for_new_ovitrap, mint_labels
from ovitraps.models import Ovitrap, OvitrapLabel
from tests.factories import MembershipFactory, OrganizationFactory
from tests.ovitrap_support import envelope, ingest, setup_field


@pytest.fixture
def field():
    return setup_field()


def place(field, identity=None, point=None):
    field.identity = identity or uuid4()
    if point is not None:
        field.point = point
    result = ingest(field, envelope(field))
    assert result.status == "accepted", result
    return Ovitrap.objects.get(client_uuid=field.identity)


def second_point(field, code):
    from tests.ovitrap_support import make_point

    return make_point(field.point.block.quadrant, code)


@pytest.mark.django_db
def test_placing_an_unregistered_label_allocates_the_next_code(field):
    first = place(field)
    second = place(field, point=second_point(field, "P-112"))

    assert (first.code, second.code) == ("OVT-0001", "OVT-0002")
    assert (
        CodeCounter.objects.get(
            organization=field.batch.organization, kind=OVITRAP_CODE.kind
        ).last_number
        == 2
    )


@pytest.mark.django_db
def test_a_replayed_placement_keeps_its_code_and_consumes_no_number(field):
    sent = envelope(field)
    assert ingest(field, sent).status == "accepted"
    assert ingest(field, sent).status == "accepted"

    assert Ovitrap.objects.get().code == "OVT-0001"
    assert CodeCounter.objects.get(organization=field.batch.organization).last_number == 1


@pytest.mark.django_db
def test_placing_a_registered_label_reuses_its_code_without_a_new_number(field):
    organization, user = field.batch.organization, field.batch.user
    (label,) = mint_labels(organization, user, 1)
    assert label.code == "OVT-0001"

    ovitrap = place(field, identity=label.client_uuid)

    assert ovitrap.code == "OVT-0001"
    assert CodeCounter.objects.get(organization=organization).last_number == 1
    # The next unregistered QR continues after the minted numbers.
    assert place(field, point=second_point(field, "P-112")).code == "OVT-0002"


@pytest.mark.django_db
def test_codes_are_per_organization(field):
    other = OrganizationFactory()
    assert code_for_new_ovitrap(field.batch.organization, uuid4()) == "OVT-0001"
    assert code_for_new_ovitrap(other, uuid4()) == "OVT-0001"


@pytest.mark.django_db
def test_the_database_refuses_a_repeated_code_in_one_organization(field):
    organization, user = field.batch.organization, field.batch.user
    (label,) = mint_labels(organization, user, 1)
    with pytest.raises(IntegrityError), transaction.atomic():
        OvitrapLabel.objects.create(
            organization=organization, created_by=user, client_uuid=uuid4(), code=label.code
        )
    other = OrganizationFactory()
    OvitrapLabel.objects.create(
        organization=other, created_by=user, client_uuid=uuid4(), code=label.code
    )


# --- label endpoints ------------------------------------------------------------------------


@pytest.mark.django_db
def test_minting_returns_consecutive_codes_and_uuids(field, api_client):
    api_client.force_authenticate(field.batch.user)

    response = api_client.post("/api/v1/ovitrap-labels/", {"count": 3}, format="json")

    assert response.status_code == 201, response.data
    labels = response.data["labels"]
    assert [label["code"] for label in labels] == ["OVT-0001", "OVT-0002", "OVT-0003"]
    assert len({label["id"] for label in labels}) == 3
    assert OvitrapLabel.objects.filter(organization=field.batch.organization).count() == 3


@pytest.mark.django_db
@pytest.mark.parametrize("count", [0, 201, -1, "x", None])
def test_minting_rejects_a_bad_count(field, api_client, count):
    api_client.force_authenticate(field.batch.user)

    response = api_client.post("/api/v1/ovitrap-labels/", {"count": count}, format="json")

    assert response.status_code == 400
    assert not OvitrapLabel.objects.exists()


@pytest.mark.django_db
def test_minting_needs_a_permission(field, api_client):
    denied = MembershipFactory(organization=field.batch.organization)
    api_client.force_authenticate(denied.user)

    assert (
        api_client.post("/api/v1/ovitrap-labels/", {"count": 1}, format="json").status_code == 403
    )


def allow_bootstrap(field):
    field.profile.permission_codes = [*field.profile.permission_codes, "field.bootstrap"]
    field.profile.save()


@pytest.mark.django_db
def test_the_pool_lists_only_unplaced_labels_of_the_organization(field, api_client):
    allow_bootstrap(field)
    organization, user = field.batch.organization, field.batch.user
    placed, free = mint_labels(organization, user, 2)
    mint_labels(OrganizationFactory(), user, 1)
    place(field, identity=placed.client_uuid)
    api_client.force_authenticate(user)

    response = api_client.get("/api/v1/field/ovitrap-labels/")

    assert response.status_code == 200, response.data
    assert [(row["id"], row["code"]) for row in response.data["labels"]] == [
        (str(free.client_uuid), free.code)
    ]


@pytest.mark.django_db
def test_the_pool_needs_the_bootstrap_permission(field, api_client):
    denied = MembershipFactory(organization=field.batch.organization)
    api_client.force_authenticate(denied.user)

    assert api_client.get("/api/v1/field/ovitrap-labels/").status_code == 403


# --- lookup ---------------------------------------------------------------------------------


@pytest.mark.django_db
def test_the_list_finds_an_ovitrap_by_short_code_or_by_identity(field, api_client):
    ovitrap = place(field)
    api_client.force_authenticate(field.batch.user)

    by_code = api_client.get("/api/v1/ovitraps/", {"code": "OVT-0001"})
    by_uuid = api_client.get("/api/v1/ovitraps/", {"code": str(ovitrap.client_uuid)})
    unknown = api_client.get("/api/v1/ovitraps/", {"code": "OVT-0099"})

    assert by_code.status_code == 200, by_code.data
    assert [row["id"] for row in by_code.data["results"]] == [str(ovitrap.client_uuid)]
    assert by_code.data["results"][0]["code"] == "OVT-0001"
    assert [row["id"] for row in by_uuid.data["results"]] == [str(ovitrap.client_uuid)]
    assert unknown.data["count"] == 0


@pytest.mark.django_db
def test_another_organizations_code_is_not_found(field, api_client):
    place(field)
    outsider = MembershipFactory(organization=OrganizationFactory())
    api_client.force_authenticate(outsider.user)

    response = api_client.get("/api/v1/ovitraps/", {"code": "OVT-0001"})

    assert response.status_code in (200, 403)
    assert response.status_code == 403 or response.data["count"] == 0


# --- backfill -------------------------------------------------------------------------------


@pytest.mark.django_db
def test_backfill_numbers_existing_ovitraps_per_organization_and_reseals_the_guard(field):
    first = place(field)
    second = place(field, point=second_point(field, "P-112"))
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        cursor.execute("ALTER TABLE ovitraps_ovitrap DISABLE TRIGGER ovitraps_ovitrap_guard")
        cursor.execute("ALTER TABLE ovitraps_ovitrap DROP CONSTRAINT ovitraps_ovitrap_code")
        cursor.execute("UPDATE ovitraps_ovitrap SET code = ''")
        cursor.execute("DELETE FROM organizations_codecounter")
        cursor.execute(
            "UPDATE ovitraps_ovitrap SET created_at = created_at - interval '1 day' WHERE id = %s",
            [str(second.pk)],
        )
        cursor.execute("ALTER TABLE ovitraps_ovitrap ENABLE TRIGGER ovitraps_ovitrap_guard")

    with connection.schema_editor() as editor:
        backfill_codes(
            editor, BackfillTarget("ovitraps_ovitrap", "ovitraps_ovitrap_guard", OVITRAP_CODE)
        )

    assert Ovitrap.objects.get(pk=second.pk).code == "OVT-0001"
    assert Ovitrap.objects.get(pk=first.pk).code == "OVT-0002"
    counter = CodeCounter.objects.get(organization=field.batch.organization, kind=OVITRAP_CODE.kind)
    assert counter.last_number == 2
    with (
        pytest.raises(DatabaseError, match="insert-only"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute("UPDATE ovitraps_ovitrap SET code = 'X'")
