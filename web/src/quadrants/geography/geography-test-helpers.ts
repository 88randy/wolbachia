import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
export const QUADRANT_ID = "00000000-0000-4000-8000-000000000001";
export const BLOCK_ID = "00000000-0000-4000-8000-000000000002";
export const POINT_ID = "00000000-0000-4000-8000-000000000003";
export const CREATED_AT = "2026-10-01T12:00:00Z";
export const POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
};
export const ALLOWED = makeMe({
  permissions: ["quadrant.read", "quadrant.publish", "sampling_point.create"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});
export function version(revision = 1): Schemas["QuadrantVersion"] {
  return {
    id: `version-${String(revision)}`,
    quadrant: QUADRANT_ID,
    area_m2: null,
    perimeter_m: null,
    geometry: POLYGON,
    revision,
    effective_from: CREATED_AT,
    created_at: CREATED_AT,
    created_by: null,
    created_by_name: null,
    point_resolutions: [],
  };
}
export function quadrant(): Schemas["Quadrant"] {
  return {
    id: QUADRANT_ID,
    code: "C-07",
    center: "center-north",
    current_version: version(),
    created_at: CREATED_AT,
    created_by: null,
  };
}
export function point(): Schemas["SamplingPoint"] {
  return {
    id: POINT_ID,
    code: "OV-010",
    block: BLOCK_ID,
    created_at: CREATED_AT,
    created_by: null,
    current_version: {
      id: "pv-1",
      point: POINT_ID,
      location: [3, 3],
      version: 1,
      is_retired: false,
      effective_from: CREATED_AT,
      created_at: CREATED_AT,
      created_by: null,
      created_by_name: null,
    },
  };
}
export function pageOf(results: unknown[] = [], extra = {}) {
  return Response.json({ count: results.length, next: null, previous: null, results, ...extra });
}
export async function openGeography(
  options: {
    path?: string;
    me?: typeof ALLOWED;
    routes?: FakeApiRoutes;
    language?: "es-MX" | "en";
  } = {},
) {
  const api = createFakeApi(geographyRoutes(options));
  const app = await renderApp({
    path: options.path ?? "/quadrants/C-07/versions",
    fetch: api.fetch,
    language: options.language ?? "es-MX",
  });
  return { api, app };
}

function geographyRoutes(options: Parameters<typeof openGeography>[0] = {}) {
  return {
    "GET /api/v1/me/": Response.json(options.me ?? ALLOWED),
    "GET /api/v1/quadrants/": pageOf([quadrant()]),
    [`GET /api/v1/quadrants/${QUADRANT_ID}/versions/`]: pageOf([version()]),
    "GET /api/v1/sampling-points/": pageOf([point()]),
    "GET /api/v1/blocks/": pageOf(),
    "GET /api/v1/centers/": pageOf([
      { id: "center-north", code: "N", name: "North", is_active: true },
    ]),
    "GET /api/v1/blocks/suggestion/": suggestionReply(),
    ...options.routes,
  };
}

function suggestionReply() {
  return Response.json([
    {
      quadrant: QUADRANT_ID,
      geometry: POLYGON,
      points: [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
      ],
      requires_review: true,
    },
  ]);
}
