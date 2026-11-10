from typing import Any

import pytest
from rest_framework import serializers

from accounts.models import User
from core.author_names import AuthorNamesMixin


class _RowSerializer(AuthorNamesMixin, serializers.Serializer[Any]):
    created_by = serializers.UUIDField(allow_null=True)
    voided_by = serializers.UUIDField(allow_null=True)


@pytest.mark.django_db
def test_author_names_resolve_in_one_query_for_a_whole_list(django_assert_num_queries) -> None:
    ana = User.objects.create(username="ana", first_name="Ana", last_name="Pech")
    beto = User.objects.create(username="beto")
    rows = [
        {"created_by": ana.pk, "voided_by": beto.pk},
        {"created_by": beto.pk, "voided_by": None},
    ]
    with django_assert_num_queries(1):
        data = _RowSerializer(rows, many=True).data
    assert [row["created_by_name"] for row in data] == ["Ana Pech", "beto"]
    assert [row["voided_by_name"] for row in data] == ["beto", None]


@pytest.mark.django_db
def test_author_name_is_blank_when_the_user_does_not_resolve() -> None:
    ghost = User(username="ghost")
    data = _RowSerializer({"created_by": ghost.pk, "voided_by": None}).data
    assert data["created_by_name"] is None
