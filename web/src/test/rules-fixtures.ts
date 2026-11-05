import { createFakeApi, makeMe } from "./fake-api";
import type { FakeApi, FakeApiRoutes } from "./fake-api";
import { renderApp } from "./render-app";
import type { Me } from "../session/me";
import type { RuleParameter, RuleParameterVersion } from "../rules/rules-query";

export const PARAMETER_KEY = "max_distance_to_point_m";
export const PARAMETER_PATH = `/settings/rule-parameters/${PARAMETER_KEY}`;
const ME = "GET /api/v1/me/";
export const PARAMETER_ROUTE = `GET /api/v1/rule-parameters/${PARAMETER_KEY}/`;
export const VERSIONS_ROUTE = `GET /api/v1/rule-parameters/${PARAMETER_KEY}/versions/`;
export const CREATE_ROUTE = `POST /api/v1/rule-parameters/${PARAMETER_KEY}/versions/`;

/** Every permission of W62: what an administrator holds. */
export const ADMIN = makeMe({
  permissions: [
    "rule_parameter.read",
    "rule_parameter_version.read",
    "rule_parameter_version.create",
    "rule_parameter_version.void",
  ],
});

/** A parameter as `GET /rule-parameters/` returns it: 50 m, allowed 0 to 500, in force since 1 Jan 2026. */
export function makeParameter(overrides: Partial<RuleParameter> = {}): RuleParameter {
  return {
    key: PARAMETER_KEY,
    value_type: "integer",
    unit: "m",
    min_value: 0,
    max_value: 500,
    value: 50,
    effective_from: "2026-01-01T06:00:00Z",
    version_id: "6b1f0d5e-0a43-4c19-8c0e-3d0f7f0a0001",
    next_change_at: null,
    ...overrides,
  };
}

/** A version as the history returns it: the one in force, written by nobody (the seed). */
export function makeVersion(overrides: Partial<RuleParameterVersion> = {}): RuleParameterVersion {
  return {
    id: "6b1f0d5e-0a43-4c19-8c0e-3d0f7f0a0001",
    value: 50,
    effective_from: "2026-01-01T06:00:00Z",
    effective_date: "2026-01-01",
    reason: "seed: design brief",
    status: "in_force",
    created_by: null,
    created_by_username: null,
    created_at: "2026-01-01T06:00:00Z",
    voided_at: null,
    voided_by: null,
    voided_by_username: null,
    void_reason: "",
    ...overrides,
  };
}

/** A page-number list answer: `{count, next, previous, results}`. */
export function pageOf(results: readonly unknown[]): Response {
  return Response.json({ count: results.length, next: null, previous: null, results });
}

interface OpenOptions {
  me?: Me;
  parameter?: RuleParameter;
  versions?: RuleParameterVersion[];
  /** Routes added to (or replacing) the defaults, e.g. the `POST` of a new version. */
  routes?: FakeApiRoutes;
  path?: string;
  language?: "es-MX" | "en";
}

/** Renders the app at a rule parameter's page (or `path`) with a fake API that serves it. */
export async function openParameterPage(options: OpenOptions = {}) {
  const { me = ADMIN, parameter = makeParameter(), versions = [makeVersion()] } = options;
  const api: FakeApi = createFakeApi({
    [ME]: Response.json(me),
    [PARAMETER_ROUTE]: () => Response.json(parameter),
    [VERSIONS_ROUTE]: ({ path }) => {
      const includeVoided = new URL(path, "http://localhost").searchParams.get("include_voided");
      return pageOf(versions.filter((v) => includeVoided === "true" || v.status !== "voided"));
    },
    ...options.routes,
  });
  const app = await renderApp({
    path: options.path ?? PARAMETER_PATH,
    fetch: api.fetch,
    me,
    ...(options.language === undefined ? {} : { language: options.language }),
  });
  return { api, app };
}

/** The requests made to exactly this path (whatever the query string), in order. */
export function requestsTo(api: FakeApi, method: string, path: string) {
  return api.requests.filter(
    (request) => request.method === method && request.path.split("?")[0] === path,
  );
}
