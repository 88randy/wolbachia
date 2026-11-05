import type { Schemas } from "@wolbachia/api-client";
import { IDENTITY_HEADER } from "../session/attestation";
import type { Me } from "../session/me";

/** One request the app made, as a test wants to inspect it. */
export interface RecordedRequest {
  method: string;
  /** Path and query, without the origin. */
  path: string;
  headers: Headers;
  /** Aborted when the app cancels the request. */
  signal: AbortSignal;
  /** Parsed JSON body, or undefined when there was none. */
  body: unknown;
}

type Reply = Response | ((request: RecordedRequest) => Response | Promise<Response>);

/** Routes are keyed `"<METHOD> <path>"`, e.g. `"GET /api/v1/me/"` (query string ignored). */
export type FakeApiRoutes = Record<string, Reply>;

export interface FakeApi {
  fetch: (request: Request) => Promise<Response>;
  requests: RecordedRequest[];
  /** Replaces or adds a route while the test runs (e.g. the session expires). */
  setRoute: (key: string, reply: Reply) => void;
}

async function record(request: Request): Promise<RecordedRequest> {
  const url = new URL(request.url);
  const text = await request.clone().text();
  return {
    method: request.method,
    path: `${url.pathname}${url.search}`,
    headers: request.headers,
    signal: request.signal,
    body: text === "" ? undefined : (JSON.parse(text) as unknown),
  };
}

/**
 * A fake network for unit tests: answers by method and path, records every request. A request
 * with no route fails the test loudly instead of returning something plausible.
 */
export function createFakeApi(initial: FakeApiRoutes = {}): FakeApi {
  const routes = new Map<string, Reply>(Object.entries(initial));
  const requests: RecordedRequest[] = [];
  return {
    requests,
    setRoute: (key, reply) => {
      routes.set(key, reply);
    },
    fetch: async (request) => {
      const recorded = await record(request);
      requests.push(recorded);
      const key = `${recorded.method} ${recorded.path.split("?")[0] ?? ""}`;
      const reply = routes.get(key);
      if (reply === undefined) throw new Error(`No fake route for ${key}`);
      const answer = typeof reply === "function" ? await reply(recorded) : reply.clone();
      return attested(answer);
    },
  };
}

/** The identity every answer of the fake server is attested for, unless a test sets its own. */
export const FAKE_IDENTITY = "fake-session-identity";

/** The fake network plays the server: every answer carries `X-Session-Identity` (#82). */
function attested(response: Response): Response {
  if (!response.headers.has(IDENTITY_HEADER)) response.headers.set(IDENTITY_HEADER, FAKE_IDENTITY);
  return response;
}

/** An API error answer: `{code, detail, fields?}` with the status and headers of the real API. */
export function apiError(
  status: number,
  code: string,
  extra: { headers?: Record<string, string>; fields?: Record<string, { code: string }[]> } = {},
): Response {
  const fields =
    extra.fields === undefined
      ? {}
      : {
          fields: Object.fromEntries(
            Object.entries(extra.fields).map(([name, errors]) => [
              name,
              errors.map(({ code: errorCode }) => ({ code: errorCode, params: {} })),
            ]),
          ),
        };
  return Response.json(
    { code, detail: `Fake ${code}.`, ...fields },
    {
      status,
      ...(extra.headers ? { headers: extra.headers } : {}),
    },
  );
}

/** An empty answer, e.g. `204` of logout or `202` of a password reset request. */
export function noContent(status = 204): Response {
  return new Response(null, { status });
}

/** An organization as `/me/` names it. */
export function makeOrganization(slug: string, name: string): NonNullable<Me["organization"]> {
  return {
    id: "0c9e5b2a-8a54-4c7f-9e0d-6a9f5f3a1b22",
    slug,
    name,
    country: "MX",
    timezone: "America/Mexico_City",
    languages: ["es-MX", "en"],
    logo_url: null,
  };
}

/** The default signed-in user of the tests: one organization, every permission of Settings. */
export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    user: {
      id: "5f5c4c3e-4a0e-4a64-9a60-1a2b3c4d5e6f",
      username: "ana.supervisora",
      email: "ana@example.org",
      first_name: "Ana",
      last_name: "Pérez",
    },
    organization: {
      id: "0c9e5b2a-8a54-4c7f-9e0d-6a9f5f3a1b21",
      slug: "norte",
      name: "Región Norte",
      country: "MX",
      timezone: "America/Mexico_City",
      languages: ["es-MX", "en"],
      logo_url: null,
    },
    profiles: [{ slug: "supervisor", label_es: "Supervisora", label_en: "Supervisor" }],
    permissions: ["catalog.read", "rule_parameter.read"],
    scope: { centers: [], quadrants: [] },
    organizations: [{ slug: "norte", name: "Región Norte" }],
    limits: { void_reason_min_length: 10, void_reason_max_length: 1000 },
    ...overrides,
  };
}

/** The backend stores the chosen code and optional note, never the catalog label as free text. */
export function makeVoidReasonFields(reasonCode: string, reason = "") {
  return { void_reason_code: reasonCode, void_reason: reason };
}

const VOID_REASON_BASE = {
  icon: "",
  sort: 0,
  is_active: true,
  is_other: false,
  requires_photo: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** Catalog fixture in API order, including an inactive reason that the picker must hide. */
export function makeVoidReasonItems(): Schemas["CatalogItem"][] {
  return [
    {
      ...VOID_REASON_BASE,
      id: "duplicate",
      code: "duplicate",
      label_es: "Capturado dos veces",
      label_en: "Duplicate entry",
    },
    {
      ...VOID_REASON_BASE,
      id: "inactive",
      code: "inactive",
      label_es: "Inactivo",
      label_en: "Inactive",
      is_active: false,
    },
    {
      ...VOID_REASON_BASE,
      id: "other",
      code: "other",
      label_es: "Otro (especificar)",
      label_en: "Other (specify)",
      is_other: true,
    },
  ];
}
