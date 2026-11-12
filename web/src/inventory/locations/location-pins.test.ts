import { expect, test } from "vitest";
import { inventoryLocation } from "../../test/inventory-fixtures";
import { clusterLocations, initialView, SINGLE_POINT_ZOOM } from "./location-pins";

const at = (id: string, lng: number, lat: number) =>
  inventoryLocation({ id, geometry: { type: "Point", coordinates: [lng, lat] } });

test("locations on the exact same coordinates share one cluster at any zoom", () => {
  const rows = [at("a", -89.5925, 20.9674), at("b", -89.5925, 20.9674), at("c", -89.5925, 20.9674)];
  for (const zoom of [3, 10, 19]) {
    const clusters = clusterLocations(rows, zoom);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.locations).toHaveLength(3);
    expect(clusters[0]?.key).toBe("a|b|c");
  }
});

test("near points cluster when zoomed out and split when zoomed in", () => {
  const rows = [at("a", -89.5925, 20.9674), at("b", -89.5915, 20.9674)];
  expect(clusterLocations(rows, 10)).toHaveLength(1);
  expect(clusterLocations(rows, 19)).toHaveLength(2);
});

test("distant points stay separate and a cluster sits at the mean of its members", () => {
  const far = clusterLocations([at("a", -89.6, 20.9), at("b", -99.1, 19.4)], 10);
  expect(far).toHaveLength(2);
  const joined = clusterLocations([at("a", -89.0, 20.0), at("b", -89.0002, 20.0)], 8);
  expect(joined[0]?.longitude).toBeCloseTo(-89.0001, 6);
});

test("cluster keys do not depend on the input order", () => {
  const a = at("a", -89.5, 20.9);
  const b = at("b", -89.5, 20.9);
  expect(clusterLocations([a, b], 12)[0]?.key).toBe(clusterLocations([b, a], 12)[0]?.key);
});

test("fit view uses bounds, or a fixed zoom when every pin is on one point", () => {
  const spread = initialView([at("a", -89.6, 20.9), at("b", -89.5, 21.0)]);
  expect(spread).toMatchObject({
    bounds: [
      [-89.6, 20.9],
      [-89.5, 21.0],
    ],
  });
  expect(initialView([at("a", -89.5925, 20.9674), at("b", -89.5925, 20.9674)])).toEqual({
    longitude: -89.5925,
    latitude: 20.9674,
    zoom: SINGLE_POINT_ZOOM,
  });
});
