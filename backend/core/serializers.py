from typing import Any

from rest_framework import serializers

from core.author_names import AuthorNamesMixin
from core.fields import OrgScopedPrimaryKeyRelatedField


class OrgScopedModelSerializer(AuthorNamesMixin, serializers.ModelSerializer[Any]):
    """Base for the serializers of org-scoped models (mandatory, see docs/engineering-rules.md).

    Every relational field it builds is an `OrgScopedPrimaryKeyRelatedField`, so a payload can
    never link a record to another organization's data. Relations to models that are not
    org-scoped (`created_by`, `organization`...) must be read-only, or the serializer fails to
    build with `ImproperlyConfigured`.
    """

    serializer_related_field = OrgScopedPrimaryKeyRelatedField
