import { describe, expect, test } from "vitest";
import { isoToZonedLocal, zonedLocalToIso } from "./permit-dates";
import { outerVertices, parsePolygon } from "./permit-geometry";
import { permitStatus } from "./permit-status";

describe("permit dates are typed in the organization's zone", () => {
  test("Mexico City wall time becomes the UTC instant and back", () => {
    expect(zonedLocalToIso("2026-07-01T10:00", "America/Mexico_City")).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(isoToZonedLocal("2026-07-01T16:00:00.000Z", "America/Mexico_City")).toBe(
      "2026-07-01T10:00",
    );
    expect(zonedLocalToIso("not a date", "UTC")).toBeNull();
  });
});

describe("permit geometry", () => {
  const ring = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ];
  test("accepts only a closed GeoJSON polygon of number pairs", () => {
    expect(parsePolygon(JSON.stringify({ type: "Polygon", coordinates: [ring] }))).not.toBeNull();
    expect(parsePolygon(JSON.stringify({ type: "Point", coordinates: [0, 0] }))).toBeNull();
    expect(
      parsePolygon(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              ["a", 1],
              [1, 1],
              [0, 0],
            ],
          ],
        }),
      ),
    ).toBeNull();
    expect(parsePolygon("{")).toBeNull();
  });
  test("lists the outer ring without the closing vertex", () => {
    expect(outerVertices({ type: "Polygon", coordinates: [ring] })).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(outerVertices(undefined)).toEqual([]);
  });
});

describe("permit status comes from the server's blockers", () => {
  test("suspended wins over expired; no blocker is valid", () => {
    const blocker = (reason: string) => ({ reason });
    expect(permitStatus([])).toBe("valid");
    expect(permitStatus([blocker("permit_expired"), blocker("permit_suspended")])).toBe(
      "suspended",
    );
    expect(permitStatus([blocker("permit_unavailable")])).toBe("unavailable");
  });
});
