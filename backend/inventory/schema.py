"""PATCH keeps optional detail fields but requires our optimistic revision token."""

from typing import Any

from core.schema import ApiAutoSchema


class InventoryAutoSchema(ApiAutoSchema):
    def _get_request_body(self, direction: str = "request") -> dict[str, Any] | None:
        body = super()._get_request_body(direction)
        if self.method != "PATCH" or not body:
            return body
        body["required"] = True
        revision = {
            "type": "object",
            "required": ["expected_revision"],
            "properties": {"expected_revision": {"type": "integer", "minimum": 0}},
        }
        for content in body["content"].values():
            content["schema"] = {"allOf": [content["schema"], revision]}
        return body
