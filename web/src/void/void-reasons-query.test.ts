import { expect, test } from "vitest";
import { createAppQueryClient } from "../api/query-client";
import { createWebApiClient } from "../api/create-web-api-client";
import { recordIdentity } from "../session/identity";
import { createFakeApi, makeMe, makeVoidReasonItems } from "../test/fake-api";
import { voidReasonsQueryOptions } from "./void-reasons-query";

const ME = makeMe();
const IDENTITY = {
  userId: ME.user.id,
  organizationSlug: ME.organization?.slug ?? "",
  revision: 0,
  isSettled: true,
};

test("keeps inactive reasons for history and Other from later catalog pages", async () => {
  const items = makeVoidReasonItems();
  const api = createFakeApi({
    "GET /api/v1/catalogs/void-reason/items/": ({ path }) => {
      const isLastPage = new URL(path, "http://localhost").searchParams.get("page") === "2";
      return Response.json({
        count: items.length,
        previous: null,
        next: isLastPage ? null : "/api/v1/catalogs/void-reason/items/?page=2",
        results: isLastPage ? items.slice(1) : items.slice(0, 1),
      });
    },
  });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  const queryClient = createAppQueryClient({ retry: false });
  recordIdentity(queryClient, ME); // only a verified identity may run org-scoped queries
  const available = await queryClient.query(voidReasonsQueryOptions(client, IDENTITY));
  expect(available.map((item) => item.code)).toEqual(["duplicate", "inactive", "other"]);
  queryClient.clear();
});
