import { waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ALLOWED, openGeography, QUADRANT_ID } from "./geography-test-helpers";
vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
test.each([
  { view: "blocks", endpoint: "/api/v1/blocks/" },
  { view: "points", endpoint: "/api/v1/sampling-points/" },
])(
  "$view sends URL search/order to its server list without narrowing the map/validation read",
  async ({ view, endpoint }) => {
    const { api, app } = await openGeography({
      path: `/quadrants/C-07/versions?view=${view}&search=OV&ordering=-code`,
      me: { ...ALLOWED, permissions: ["quadrant.read"] },
    });
    await waitFor(() => {
      const queries = api.requests
        .filter((request) => request.path.startsWith(endpoint))
        .map((request) => new URL(request.path, "http://api.invalid").searchParams);
      expect(
        queries.some(
          (query) =>
            query.get("quadrant") === QUADRANT_ID &&
            query.get("search") === "OV" &&
            query.get("ordering") === "-code",
        ),
      ).toBe(true);
      expect(queries.some((query) => !query.has("search") && !query.has("ordering"))).toBe(true);
    });
    expect(app.router.state.location.search).toMatchObject({
      view,
      search: "OV",
      ordering: "-code",
    });
  },
);
