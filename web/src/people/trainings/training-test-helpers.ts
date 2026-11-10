import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
export const SUBJECT = "00000000-0000-4000-8000-000000000148";
export const CENTER = "00000000-0000-4000-8000-000000000010";
export const VERSION = "00000000-0000-4000-8000-000000000020";
export const CERTIFICATE = "00000000-0000-4000-8000-000000000030";
export const ALL_SCOPE = {
  centers: { mode: "all" as const, ids: [] },
  quadrants: { mode: "all" as const, ids: [] },
};
export const TRAINING_ME = makeMe({
  permissions: ["training.read", "training.manage", "field.upload"],
  scope: ALL_SCOPE,
});
export function page<Row>(results: Row[]) {
  return { results, count: results.length, next: null, previous: null };
}
export function eligibility(
  overrides: Partial<Schemas["EligibilityRead"]> = {},
): Schemas["EligibilityRead"] {
  return {
    subject_id: SUBJECT,
    action: "release.record",
    center_id: CENTER,
    quadrant_id: null,
    training_eligible: true,
    requirement_version_id: VERSION,
    certification_ids: [CERTIFICATE],
    training_version_ids: [VERSION],
    revocation_ids: [],
    valid_from: "2026-11-09T12:00:00Z",
    valid_until: "2026-11-10T12:00:00Z",
    next_change_at: "2026-11-10T12:00:00Z",
    blockers: [],
    query_kind: "retrospective",
    ...overrides,
  };
}
export async function openTrainings(
  options: { routes?: FakeApiRoutes; path?: string; me?: typeof TRAINING_ME } = {},
) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(options.me ?? TRAINING_ME),
    "GET /api/v1/trainings/": Response.json(page([])),
    "GET /api/v1/training-requirements/": Response.json(page([])),
    [`GET /api/v1/users/${SUBJECT}/trainings/`]: Response.json(page([])),
    ...options.routes,
  });
  const app = await renderApp({ path: options.path ?? "/people/trainings", fetch: api.fetch });
  return { ...app, api };
}
