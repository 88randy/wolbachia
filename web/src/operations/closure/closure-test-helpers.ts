import type { Schemas } from "@wolbachia/api-client";
import type { FakeApiRoutes } from "../../test/fake-api";
import { createFakeApi, makeMe } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import {
  quadrant,
  pageOf,
  QUADRANT_ID,
  version,
  CREATED_AT,
} from "../../quadrants/geography/geography-test-helpers";
export { quadrant, pageOf, QUADRANT_ID, version };
export const CLOSURE_PATH = `/api/v1/quadrants/${QUADRANT_ID}/closure/`;
export const CLOSE_PATH = `/api/v1/quadrants/${QUADRANT_ID}/close/`;
export const ALLOWED = makeMe({
  permissions: ["quadrant.read", "quadrant.close"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});
export function readiness(
  overrides: Partial<Schemas["QuadrantReadiness"]> = {},
): Schemas["QuadrantReadiness"] {
  return {
    quadrant_id: QUADRANT_ID,
    quadrant_version_id: version().id,
    revision: 1,
    is_closed: false,
    can_close: true,
    blockers: [],
    closure: null,
    ...overrides,
  };
}
export function receipt(): Schemas["QuadrantClosure"] {
  return {
    id: "closure-receipt-1",
    quadrant_version: version(2).id,
    revision: 2,
    closed_at: CREATED_AT,
    created_at: CREATED_AT,
    created_by: null,
  };
}
export async function openClosure(options: { me?: typeof ALLOWED; routes?: FakeApiRoutes } = {}) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(options.me ?? ALLOWED),
    "GET /api/v1/quadrants/": pageOf([quadrant()]),
    [`GET ${CLOSURE_PATH}`]: Response.json(readiness()),
    ...options.routes,
  });
  const app = await renderApp({ path: "/quadrants/C-07/closure", fetch: api.fetch });
  return { api, app };
}
