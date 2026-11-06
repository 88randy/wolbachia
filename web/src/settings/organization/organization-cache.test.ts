import { QueryClient } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { createWebApiClient } from "../../api/create-web-api-client";
import { makeOrganization } from "../../test/fake-api";
import { organizationOptions } from "./use-w-03";
import type { AdminContext } from "./use-w-03";
import { publishOrganization } from "./organization-cache";
const ORGANIZATION = { ...makeOrganization("norte", "Programa"), revision: 4 };
function context() {
  return {
    queryClient: new QueryClient(),
    client: createWebApiClient({ apiBaseUrl: "/api/v1" }),
    identity: {
      userId: "actor",
      organizationSlug: "norte",
      revision: 1,
      isSettled: true,
      authorization: "grant",
      activeCenter: "A",
    },
  };
}
function seed(owner: AdminContext & { queryClient: QueryClient }) {
  const options = organizationOptions(owner);
  owner.queryClient.setQueryDefaults(options.queryKey, { meta: options.meta });
  owner.queryClient.setQueryData(options.queryKey, ORGANIZATION);
  return options.queryKey;
}
test("publishing organization settings updates center variants without touching other actors, organizations or grants", async () => {
  const owner = context();
  const queries = [
    seed(owner),
    seed({ ...owner, identity: { ...owner.identity, activeCenter: "B" } }),
    seed({ ...owner, identity: { ...owner.identity, userId: "other" } }),
    seed({ ...owner, identity: { ...owner.identity, organizationSlug: "sur" } }),
    seed({ ...owner, identity: { ...owner.identity, authorization: "revoked" } }),
  ];
  const guard = { signal: new AbortController().signal, isStale: () => false };
  await publishOrganization(owner, { ...ORGANIZATION, revision: 5, timezone: "UTC" }, guard);
  expect(queries.map((query) => owner.queryClient.getQueryData(query)?.revision)).toEqual([
    5, 5, 4, 4, 4,
  ]);
  await publishOrganization(owner, ORGANIZATION, guard);
  expect(queries.map((query) => owner.queryClient.getQueryData(query)?.revision)).toEqual([
    5, 5, 4, 4, 4,
  ]);
  owner.queryClient.clear();
});

test("stale write responses cannot cancel current reads or publish after asynchronous cancellation", async () => {
  const owner = context();
  const query = seed(owner);
  let release!: () => void;
  const cancellation = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cancel = vi
    .spyOn(owner.queryClient, "cancelQueries")
    .mockImplementation(() => cancellation);
  let isStale = false;
  const guard = { signal: new AbortController().signal, isStale: () => isStale };
  const publishing = publishOrganization(owner, { ...ORGANIZATION, revision: 5 }, guard);
  expect(cancel).toHaveBeenCalledTimes(1);
  isStale = true;
  release();
  expect(await publishing).toBe(false);
  expect(owner.queryClient.getQueryData(query)?.revision).toBe(4);
  expect(await publishOrganization(owner, { ...ORGANIZATION, revision: 5 }, guard)).toBe(false);
  expect(cancel).toHaveBeenCalledTimes(1);
  owner.queryClient.clear();
});
