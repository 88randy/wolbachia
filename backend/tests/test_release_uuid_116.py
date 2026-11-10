"""Valid UUID spellings retain the original payload while proving the same identities."""

from uuid import UUID, uuid4

import pytest

from field_sync.models import FieldEvent
from releases.payloads import ReleasePayload
from tests.releases_support import accept_release, release_setup


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("spelling", ["hex", "urn"])
def test_release_source_proof_accepts_uuid_spellings_without_rewriting_original_payload(
    spelling, org_a, make_member, monkeypatch, settings, tmp_path
):
    context = release_setup(org_a, make_member, monkeypatch, settings, tmp_path)
    for key in ("permit_id", "release_device_id", "lot_id", "training_version", "schedule_task_id"):
        context.capture["payload"][key] = getattr(UUID(context.capture["payload"][key]), spelling)
    released = accept_release(context)
    source = FieldEvent.objects.get(pk=context.capture["id"])
    assert source.payload == context.capture["payload"]
    assert released.permit_version_id == context.permit_version.pk
    assert released.provenance["source_payload_hash"] == source.payload_sha256


def test_release_identifiers_require_uuid_strings_as_declared_in_the_contract():
    values = {
        key: str(uuid4())
        for key in (
            "permit_id",
            "release_device_id",
            "lot_id",
            "training_version",
            "schedule_task_id",
        )
    }
    values.update(quantity="1", evidence_ids=[])
    values["permit_id"] = uuid4().int
    body = ReleasePayload(data=values)
    assert not body.is_valid()
    assert body.errors["permit_id"][0].code == "invalid"
