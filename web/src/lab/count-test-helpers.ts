import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

export const BAG = "00000000-0000-4000-8000-000000000031";
export const COUNT = "00000000-0000-4000-8000-000000000032";
export const candidate = (code = "B-031"): Schemas["LabQueueCandidate"] => ({
  id: BAG, code, reading_id: "reading-31", expected_revision: 0,
  has_eggs: true, is_lagged: false, is_index_excluded: false,
});
export const count = (overrides: Partial<Schemas["LabCount"]> = {}): Schemas["LabCount"] => ({
  id: COUNT, bag_id: BAG, value: 12, ordinal: 1, viable_eggs: null, total_examined: null,
  viability_percent: null, viability_reason: "not_requested", method_version: null,
  method: null, verification_id: null, rules: {}, source_proof: {},
  created_at: "2026-11-03T15:00:00Z", created_by: "counter-31", voided: false,
  expected_revision: 1, current_revision: 1, is_current: true, ...overrides,
});
export const pageOf = (results: unknown[]) => Response.json({ count: results.length, next: null, previous: null, results });
export const outcome = (next: Schemas["LabQueueCandidate"] | null = null) => Response.json({
  count: count(), next_bag: next, queue_snapshot: { as_of: "2026-11-03T15:00:00Z", context: {} },
}, { status: 201 });

export async function openCount(options: { routes?: FakeApiRoutes; history?: boolean; permissions?: string[]; language?: "en" | "es-MX" } = {}) {
  const me = makeMe({ permissions: options.permissions ?? ["egg_count.create", "egg_count.read", "egg_count.void", "catalog.read"],
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } } });
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(me),
    "GET /api/v1/egg-counts/queue/": pageOf([candidate()]),
    "GET /api/v1/egg-counts/": pageOf([count()]),
    ...options.routes,
  });
  const app = await renderApp({ path: options.history ? "/lab/count-history?code=B-031" : "/lab/egg-counts", fetch: api.fetch, language: options.language });
  return { api, app };
}
