"""A lab read never fails NOWAIT because another read holds the same rows (the web fires several)."""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from lab.independent_qa.services import numeric_read_transaction
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db


def test_numeric_read_transaction_waits_for_locks_instead_of_failing_nowait(org_a, make_member):
    user, _ = make_member(org_a)

    with (
        CaptureQueriesContext(connection) as queries,
        numeric_read_transaction(UploadActor(user, org_a)),
    ):
        pass

    locks = [q["sql"] for q in queries if "FOR NO KEY UPDATE" in q["sql"]]
    assert locks, "the read must still pin the actor and the organization"
    assert not [sql for sql in locks if "NOWAIT" in sql], locks
