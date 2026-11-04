"""The two paging styles of docs/api-conventions.md; each endpoint declares one."""

from django.conf import settings
from rest_framework.pagination import CursorPagination, PageNumberPagination

MAX_PAGE_SIZE = 200


class StandardPagination(PageNumberPagination):
    """Page number (`?page=&page_size=`) for admin tables. Default size: `API_PAGE_SIZE`."""

    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


class StreamCursorPagination(CursorPagination):
    """Cursor (`?cursor=`) for large or streaming lists: sync changes, access log, events."""

    ordering = "-created_at"
    page_size = settings.API_CURSOR_PAGE_SIZE
