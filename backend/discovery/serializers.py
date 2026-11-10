"""Query validation and response shapes. Responses carry codes and params, never text."""

from typing import Any

from rest_framework import serializers

from core.author_names import AuthorNamesMixin
from discovery.sources import RECORD_TYPES

SEARCH_MAX_LENGTH = 50
SEARCH_MAX_PAGE = 1000
SEARCH_MAX_PAGE_SIZE = 50
SEARCH_DEFAULT_PAGE_SIZE = 5
HISTORY_MAX_PAGE_SIZE = 100
HISTORY_DEFAULT_PAGE_SIZE = 25
CURSOR_MAX_LENGTH = 512


class SearchQuerySerializer(serializers.Serializer[Any]):
    q = serializers.CharField(max_length=SEARCH_MAX_LENGTH)
    include_voided = serializers.BooleanField(default=False)
    type = serializers.ChoiceField(choices=RECORD_TYPES, required=False)
    page = serializers.IntegerField(min_value=1, max_value=SEARCH_MAX_PAGE, default=1)
    page_size = serializers.IntegerField(
        min_value=1, max_value=SEARCH_MAX_PAGE_SIZE, default=SEARCH_DEFAULT_PAGE_SIZE
    )

    def validate_q(self, value: str) -> str:
        if "\x00" in value:
            raise serializers.ValidationError("NUL is not allowed.", code="invalid_characters")
        return value


class HistoryQuerySerializer(serializers.Serializer[Any]):
    cursor = serializers.CharField(max_length=CURSOR_MAX_LENGTH, required=False)
    page_size = serializers.IntegerField(
        min_value=1, max_value=HISTORY_MAX_PAGE_SIZE, default=HISTORY_DEFAULT_PAGE_SIZE
    )


class SearchHitSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=RECORD_TYPES)
    id = serializers.UUIDField()
    code = serializers.CharField()
    is_voided = serializers.BooleanField()


class SearchGroupSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=RECORD_TYPES)
    count = serializers.IntegerField()
    hits = SearchHitSerializer(many=True)


class SearchResponseSerializer(serializers.Serializer[Any]):
    q = serializers.CharField()
    groups = SearchGroupSerializer(many=True)


class LinkFilterSerializer(serializers.Serializer[Any]):
    resource = serializers.CharField()
    filters = serializers.DictField(child=serializers.CharField())


class SummaryCardSerializer(LinkFilterSerializer):
    key = serializers.CharField()
    value = serializers.IntegerField()
    cutoff = serializers.DateTimeField()


class HomeItemSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=RECORD_TYPES)
    code = serializers.CharField()
    severity = serializers.CharField()
    deadline = serializers.DateTimeField(allow_null=True)


class SupportSerializer(serializers.Serializer[Any]):
    contact = serializers.CharField(allow_blank=True)


class HomeSummarySerializer(serializers.Serializer[Any]):
    cutoff = serializers.DateTimeField()
    cards = SummaryCardSerializer(many=True)
    critical = HomeItemSerializer(many=True)
    attention = HomeItemSerializer(many=True)
    link_filters = serializers.DictField(child=LinkFilterSerializer())
    support = SupportSerializer(allow_null=True)


class TimelineAuthorSerializer(serializers.Serializer[Any]):
    username = serializers.CharField()


class RelatedRefSerializer(serializers.Serializer[Any]):
    type = serializers.ChoiceField(choices=RECORD_TYPES)
    code = serializers.CharField()


class TimelineEntrySerializer(AuthorNamesMixin, serializers.Serializer[Any]):
    source_type = serializers.CharField()
    source_id = serializers.UUIDField()
    occurred_at = serializers.DateTimeField()
    kind = serializers.CharField()
    author = TimelineAuthorSerializer(allow_null=True)
    reason = serializers.CharField(allow_null=True)
    refs = RelatedRefSerializer(many=True)
    params = serializers.DictField()


class HistoryResponseSerializer(serializers.Serializer[Any]):
    record = SearchHitSerializer()
    results = TimelineEntrySerializer(many=True)
    next_cursor = serializers.CharField(allow_null=True)
