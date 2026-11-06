import { expect, test } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { begin, commitKnown } from "../session/session-controller";
import { currentRevision } from "../session/session-revision";
import { sessionIdentityOf } from "../session/org-scoped-query";
import { createFakeApi, makeMe, FAKE_IDENTITY } from "../test/fake-api";
import { readTableState } from "../data-table/table-state";
import { QUADRANT_TABLE } from "../quadrants/geography/geography-table";
import {
  quadrantListOptions,
  quadrantRecordOptions,
  blocksOptions,
  pointsOptions,
} from "../quadrants/geography/geography-query";
import { fleetListOptions, fleetRecordOptions } from "../fleet/fleet-query";
function context(activeCenter?: string, urlCenter?: string) {
  const queryClient = createAppQueryClient({ retry: false });
  const me = makeMe({
    permissions: ["quadrant.read", "motorcycle.read"],
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  });
  const page = () => Response.json({ count: 0, results: [], next: null, previous: null });
  const api = createFakeApi({
    "GET /api/v1/quadrants/": page,
    "GET /api/v1/motorcycles/": page,
    "GET /api/v1/blocks/": page,
    "GET /api/v1/sampling-points/": page,
  });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  commitKnown(queryClient, begin(queryClient, "verify"), { me, attestation: FAKE_IDENTITY });
  const identity = { ...sessionIdentityOf(me, currentRevision(), true), activeCenter };
  const scope = {
    client,
    identity,
    me,
    context: "center-contract",
    canRead: true,
    canPublish: false,
    canCreatePoint: false,
    canCreateQuadrant: false,
    urlCenter,
  };
  const state = readTableState(urlCenter ? { center: urlCenter } : {}, QUADRANT_TABLE).state;
  return { queryClient, scope, state, api };
}
type Kind = "quadrants" | "quadrant-code" | "motorcycles" | "motorcycle-code";
async function execute(kind: Kind, setup: ReturnType<typeof context>) {
  const { scope, state, queryClient } = setup;
  if (kind === "quadrants") await queryClient.query(quadrantListOptions(scope, state));
  if (kind === "quadrant-code") await queryClient.query(quadrantRecordOptions(scope, "Q"));
  if (kind === "motorcycles") await queryClient.query(fleetListOptions(scope, state));
  if (kind === "motorcycle-code") await queryClient.query(fleetRecordOptions(scope, "M"));
}
for (const kind of ["quadrants", "quadrant-code", "motorcycles", "motorcycle-code"] as const) {
  test.each([
    { url: "A", active: "B", expected: "A" },
    { url: undefined, active: "B", expected: "B" },
    { url: undefined, active: undefined, expected: null },
  ])(
    `${kind} uses URL center, then active center, then no parameter: $expected`,
    async ({ url, active, expected }) => {
      const setup = context(active, url);
      try {
        await execute(kind, setup);
        expect(
          new URL(setup.api.requests[0]?.path ?? "", "http://localhost").searchParams.get("center"),
        ).toBe(expected);
      } finally {
        setup.queryClient.clear();
      }
    },
  );
}
test("blocks and sampling points retain their quadrant constraint without inventing a center parameter", async () => {
  const setup = context("B", "A");
  try {
    await setup.queryClient.query(blocksOptions(setup.scope, "Q", 1));
    await setup.queryClient.query(pointsOptions(setup.scope, "Q", 1));
    for (const request of setup.api.requests) {
      const params = new URL(request.path, "http://localhost").searchParams;
      expect(params.get("center")).toBeNull();
      expect(params.get("quadrant")).toBe("Q");
    }
  } finally {
    setup.queryClient.clear();
  }
});
