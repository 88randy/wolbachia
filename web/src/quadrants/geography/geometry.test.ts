import { appendMapVertex } from "./map-drawing";
import { describe, expect, test } from "vitest";
import { parsePolygon, containsLocation, resolutionPayload } from "./geometry";

describe("coordinate form parity and excluded-point validation", () => {
  test("requires closed finite WGS84 polygons with three distinct vertices", () => {
    for (const text of [
      "",
      "0,0\n1,0\n0,1",
      "181,0\n1,0\n0,1\n181,0",
      "0,0\nNaN,0\n0,1\n0,0",
      "0,0\n1,0\n0,0\n0,0",
    ]) {
      expect(parsePolygon(text)).toBeNull();
    }
    expect(parsePolygon("0,0\n1,0\n0,1\n0,0")?.type).toBe("Polygon");
  });
  test("keeps boundary points inside and excludes holes without silently moving coordinates", () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [1, 1],
        ],
      ],
    };
    expect(containsLocation(polygon, [0, 2])).toBe(true);
    expect(containsLocation(polygon, [1.5, 1.5])).toBe(false);
    expect(containsLocation(polygon, [1, 1.5])).toBe(true);
    expect(containsLocation(polygon, [5, 2])).toBe(false);
  });
  test("requires evidence and a move inside the new polygon", () => {
    const geometry = parsePolygon("0,0\n4,0\n0,4\n0,0");
    if (!geometry) throw new Error("Missing polygon");
    expect(resolutionPayload({ point: "p", decision: "keep", evidence: " " }, geometry)).toBeNull();
    expect(
      resolutionPayload(
        { point: "p", decision: "move", evidence: "Inspected", location: "5,5" },
        geometry,
      ),
    ).toBeNull();
    expect(
      resolutionPayload(
        { point: "p", decision: "remove", evidence: "Retire after inspection" },
        geometry,
      ),
    ).toEqual({ point: "p", decision: "remove", evidence: "Retire after inspection" });
  });
});

test("map drawing inserts before the existing closure and preserves holes", () => {
  const current = "0,0\n4,0\n4,4\n0,4\n0,0\n\n1,1\n2,1\n1,2\n1,1";
  const next = parsePolygon(appendMapVertex(current, [-1, 2]));
  expect(next?.coordinates[0]?.slice(-2)).toEqual([
    [-1, 2],
    [0, 0],
  ]);
  expect(next?.coordinates[1]).toEqual([
    [1, 1],
    [2, 1],
    [1, 2],
    [1, 1],
  ]);
});
