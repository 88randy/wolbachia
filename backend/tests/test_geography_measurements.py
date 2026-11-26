"""Stored geodesic area/perimeter of quadrant and block versions."""

from math import cos, degrees, radians

import pytest

from geography.geometry import EARTH_RADIUS_M, polygon_measurements
from tests.test_geography_b_11 import geography_setup, polygon, publish

SIDE_M = 100.0


def square(side_m=SIDE_M, west=-100.0, south=20.0):
    lat_step = degrees(side_m / EARTH_RADIUS_M)
    lon_step = lat_step / cos(radians(south))
    east, north = west + lon_step, south + lat_step
    return {
        "type": "Polygon",
        "coordinates": [
            [[west, south], [east, south], [east, north], [west, north], [west, south]]
        ],
    }


def test_known_square_area_and_perimeter():
    area, perimeter = polygon_measurements(square())
    assert area == pytest.approx(SIDE_M**2, rel=0.005)
    assert perimeter == pytest.approx(4 * SIDE_M, rel=0.005)


def test_hole_subtracts_area_and_adds_perimeter():
    outer = square(200)["coordinates"][0]
    hole = square(50, west=-99.9995, south=20.0005)["coordinates"][0]
    area, perimeter = polygon_measurements({"type": "Polygon", "coordinates": [outer, hole]})
    assert area == pytest.approx(200**2 - 50**2, rel=0.01)
    assert perimeter == pytest.approx(4 * 200 + 4 * 50, rel=0.01)


@pytest.mark.django_db
def test_versions_store_measurements_and_api_exposes_them(api_client):
    from geography.services import BlockCreation, create_block

    membership, quadrant = geography_setup()
    version = publish(quadrant, membership, polygon())
    expected_area, expected_perimeter = polygon_measurements(polygon())
    assert version.area_m2 == pytest.approx(expected_area)
    assert version.perimeter_m == pytest.approx(expected_perimeter)
    block, block_version = create_block(quadrant, BlockCreation(membership, "B-M", square()))
    assert block_version.area_m2 == pytest.approx(SIDE_M**2, rel=0.005)

    api_client.force_authenticate(membership.user)
    current = api_client.get(f"/api/v1/quadrants/{quadrant.pk}/").data["current_version"]
    assert current["area_m2"] == pytest.approx(expected_area)
    assert current["perimeter_m"] == pytest.approx(expected_perimeter)
    block_current = api_client.get(f"/api/v1/blocks/{block.pk}/").data["current_version"]
    assert block_current["area_m2"] == pytest.approx(SIDE_M**2, rel=0.005)
    assert block_current["perimeter_m"] == pytest.approx(4 * SIDE_M, rel=0.005)
