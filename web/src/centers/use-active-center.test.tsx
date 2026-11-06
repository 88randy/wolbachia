import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { begin, commitKnown } from "../session/session-controller";
import { createFakeApi, FAKE_IDENTITY, makeMe } from "../test/fake-api";
import { centerStorageKey, readCenter, writeCenter } from "./center-selection";
import { useActiveCenter } from "./use-active-center";

test.each([
  { mode: "all", ids: [], expected: "center-a" },
  { mode: "selected", ids: ["center-a"], expected: "center-a" },
  { mode: "selected", ids: ["center-b"], expected: "" },
  { mode: "selected", ids: [], expected: "" },
  { mode: "none", ids: [], expected: "" },
] as const)(
  "active center intersects the stored preference with $mode/$ids without center.read or a centers query",
  ({ mode, ids, expected }) => {
    const me = makeMe({
      permissions: ["quadrant.read"],
      scope: { centers: { mode, ids: [...ids] }, quadrants: { mode: "all", ids: [] } },
    });
    const queryClient = createAppQueryClient({ retry: false });
    const api = createFakeApi({ "GET /api/v1/me/": () => Response.json(me) });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
    commitKnown(queryClient, begin(queryClient, "verify"), { me, attestation: FAKE_IDENTITY });
    const key = centerStorageKey(me);
    writeCenter(key, "center-a");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      </QueryClientProvider>
    );
    const view = renderHook(useActiveCenter, { wrapper });
    try {
      expect(view.result.current).toBe(expected);
      expect(readCenter(key)).toBe(expected);
      expect(window.localStorage.getItem(key)).toBe(expected || null);
      expect(api.requests).toHaveLength(0);
    } finally {
      view.unmount();
      queryClient.clear();
      writeCenter(key, "");
    }
  },
);
