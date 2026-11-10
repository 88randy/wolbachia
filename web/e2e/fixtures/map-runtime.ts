import type { Page } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { makeMe } from "../../src/test/fake-api";
import { mockApi } from "./mock-api";

const QUADRANT_ID = "00000000-0000-4000-8000-000000000225";
const CREATED_AT = "2026-10-01T12:00:00Z";
const QUADRANT: Schemas["Quadrant"] = {
  id: QUADRANT_ID,
  code: "C-DEMO",
  center: "center-demo",
  created_at: CREATED_AT,
  created_by: null,
  current_version: {
    id: "version-demo",
    quadrant: QUADRANT_ID,
    revision: 1,
    effective_from: CREATED_AT,
    created_at: CREATED_AT,
    created_by: null,
    created_by_name: null,
    point_resolutions: [],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
      ],
    },
  },
};
// Generated 1x1 transparent RGBA PNG; no provider asset is downloaded or committed.
const SYNTHETIC_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
  "base64",
);
const pageOf = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

export async function installMapRuntimeApi(page: Page) {
  await mockApi(page, {
    me: makeMe({
      permissions: ["quadrant.read", "quadrant.publish"],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  await page.route("**/api/v1/quadrants/**", (route) => {
    const isHistory = new URL(route.request().url()).pathname.endsWith("/versions/");
    const history = QUADRANT.current_version ? [QUADRANT.current_version] : [];
    return route.fulfill({ json: pageOf(isHistory ? history : [QUADRANT]) });
  });
  for (const resource of ["blocks", "sampling-points"]) {
    await page.route(`**/api/v1/${resource}/**`, (route) => route.fulfill({ json: pageOf([]) }));
  }
}

export async function interceptSyntheticTiles(page: Page, applicationOrigin: string) {
  const observed = { tiles: [] as string[], unexpectedOrigins: [] as string[] };
  // Context routing covers requests from dedicated Workers as well as the page.
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === applicationOrigin) return route.fallback();
    if (url.origin === "https://tile.openstreetmap.org") {
      observed.tiles.push(url.href);
      return route.fulfill({
        contentType: "image/png",
        body: SYNTHETIC_TILE,
        headers: { "access-control-allow-origin": applicationOrigin },
      });
    }
    observed.unexpectedOrigins.push(url.origin);
    return route.abort("blockedbyclient");
  });
  return observed;
}
