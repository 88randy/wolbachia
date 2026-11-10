"""Static vector-tile extract served by our own infrastructure (OSM tile policy).

The extract is a Protomaps basemap cut (c) OpenStreetMap contributors, ODbL. The app downloads it
once and keeps it on the device, so no phone ever hits tile.openstreetmap.org. It contains public
map data only, so it needs no session.
"""

from pathlib import Path
from typing import Any

from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.views import APIView

MAP_DATA_DIR = Path(__file__).resolve().parent / "map_data"
AVAILABLE_EXTRACTS = {"merida"}


class MapTilesView(APIView):
    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes: list[Any] = []

    @extend_schema(exclude=True)
    def get(self, request: Request, name: str) -> FileResponse:
        if name not in AVAILABLE_EXTRACTS:
            raise Http404
        response = FileResponse(
            (MAP_DATA_DIR / f"{name}.pmtiles").open("rb"),
            content_type="application/octet-stream",
        )
        response["Cache-Control"] = "public, max-age=86400"
        return response
