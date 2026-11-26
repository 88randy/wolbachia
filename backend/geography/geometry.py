"""Pure WGS84 GeoJSON validation and small-area geometry; no database or Django.

Distances use a mean-radius sphere (haversine), at most 0.6% from WGS84
ellipsoidal geodesics. Polygon edges are planar lon/lat segments; polygons
crossing the antimeridian (longitude span >180 degrees) are refused.
"""

from math import asin, cos, isfinite, radians, sin, sqrt
from typing import Any

from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.validation import explain_validity

EARTH_RADIUS_M = 6_371_008.8
SUGGESTION_POINT_COUNT = 4


def validate_location(value: object) -> list[float]:
    """Require exactly two finite coordinates in [longitude, latitude] order."""
    if not isinstance(value, list | tuple) or len(value) != 2:
        raise ValueError("Use [longitude, latitude].")
    if any(isinstance(number, bool) or not isinstance(number, int | float) for number in value):
        raise ValueError("Coordinates must be numbers.")
    try:
        longitude, latitude = (float(number) for number in value)
    except OverflowError as error:
        raise ValueError("Coordinates are outside WGS84 bounds.") from error
    if not isfinite(longitude) or not isfinite(latitude):
        raise ValueError("Coordinates must be finite.")
    if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        raise ValueError("Coordinates are outside WGS84 bounds.")
    return [longitude, latitude]


def _ring(value: object) -> list[list[float]]:
    if not isinstance(value, list) or len(value) < 4:
        raise ValueError("A closed ring needs at least four positions.")
    positions = [validate_location(position) for position in value]
    if positions[0] != positions[-1]:
        raise ValueError("Rings must be explicitly closed.")
    return positions


def validate_polygon(value: object) -> dict[str, Any]:
    """Normalize Polygon only, including holes, and reject invalid/self-crossing rings."""
    if not isinstance(value, dict) or value.get("type") != "Polygon":
        raise ValueError("Only GeoJSON Polygon is supported.")
    rings = value.get("coordinates")
    if not isinstance(rings, list) or not rings:
        raise ValueError("A polygon needs an exterior ring.")
    geometry = {"type": "Polygon", "coordinates": [_ring(ring) for ring in rings]}
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
        raise ValueError(explain_validity(polygon))
    if polygon.bounds[2] - polygon.bounds[0] > 180:
        raise ValueError("Antimeridian-crossing polygons are unsupported.")
    return geometry


def contains_point(geometry: dict[str, Any], location: list[float]) -> bool:
    """Boundary counts as inside; hole interiors do not."""
    return bool(shape(geometry).covers(Point(validate_location(location))))


def covers_polygon(parent: dict[str, Any], child: dict[str, Any]) -> bool:
    return bool(shape(parent).covers(shape(child)))


def distance_m(first: list[float], second: list[float]) -> float:
    """Shortest spherical distance, including across the antimeridian (<=0.6% error)."""
    first_lon, first_lat = map(radians, validate_location(first))
    second_lon, second_lat = map(radians, validate_location(second))
    haversine = (
        sin((second_lat - first_lat) / 2) ** 2
        + cos(first_lat) * cos(second_lat) * sin((second_lon - first_lon) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * asin(sqrt(min(1.0, max(0.0, haversine))))


def _ring_area_m2(ring: list[list[float]]) -> float:
    """Signed spherical ring area (Chamberlain & Duquette, JPL 2007) on the mean-radius sphere."""
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(ring, ring[1:], strict=False):
        total += radians(lon2 - lon1) * (2 + sin(radians(lat1)) + sin(radians(lat2)))
    return total * EARTH_RADIUS_M**2 / 2


def polygon_measurements(geometry: dict[str, Any]) -> tuple[float, float]:
    """Geodesic (area m2, perimeter m) of a validated Polygon; holes subtract area, add perimeter.

    Same sphere as distance_m, the analogue of ST_Area/ST_Perimeter on geography with
    use_spheroid=false. Rings are summed edge by edge, so all rings count in the perimeter.
    """
    rings = geometry["coordinates"]
    exterior, *holes = (abs(_ring_area_m2(ring)) for ring in rings)
    perimeter = sum(
        distance_m(first, second)
        for ring in rings
        for first, second in zip(ring, ring[1:], strict=False)
    )
    return max(0.0, exterior - sum(holes)), perimeter


def _halves(polygon: Polygon) -> list[Polygon]:
    west, south, east, north = polygon.bounds
    if east - west >= north - south:
        middle = (west + east) / 2
        windows = [box(west, south, middle, north), box(middle, south, east, north)]
    else:
        middle = (south + north) / 2
        windows = [box(west, south, east, middle), box(west, middle, east, north)]
    pieces = [polygon.intersection(window) for window in windows]
    return [
        part
        for piece in pieces
        for part in (list(piece.geoms) if hasattr(piece, "geoms") else [piece])
        if part.geom_type == "Polygon" and part.area > 0
    ]


def suggest_points(geometry: dict[str, Any]) -> list[list[float]]:
    """Split the largest area repeatedly; four interior candidates require human review."""
    pieces = [shape(validate_polygon(geometry))]
    while len(pieces) < SUGGESTION_POINT_COUNT:
        largest = max(pieces, key=lambda piece: piece.area)
        pieces.remove(largest)
        halves = _halves(largest)
        if len(halves) < 2:
            raise ValueError("Geometry is too small to suggest four distinct points.")
        pieces.extend(halves)
    pieces.sort(key=lambda piece: (-piece.area, piece.bounds))
    return [
        [float(piece.representative_point().x), float(piece.representative_point().y)]
        for piece in pieces[:SUGGESTION_POINT_COUNT]
    ]


def available_block_geometries(
    geometry: dict[str, Any], occupied: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Offer only uncovered Polygon pieces; never propose an already published block."""
    remaining = shape(geometry).difference(unary_union([shape(block) for block in occupied]))
    pieces = list(remaining.geoms) if hasattr(remaining, "geoms") else [remaining]
    return [
        {
            "type": "Polygon",
            "coordinates": [
                [list(position) for position in ring.coords]
                for ring in [piece.exterior, *piece.interiors]
            ],
        }
        for piece in pieces
        if piece.geom_type == "Polygon" and not piece.is_empty
    ]
