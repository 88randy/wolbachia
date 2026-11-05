import { CancelledError, QueryClient } from "@tanstack/react-query";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { findUnscopedQueries } from "../test/find-unscoped-queries";
import { orgScopedQueryOptions } from "./org-scoped-query";
import type { SessionIdentity } from "./org-scoped-query";
import { changeIdentity } from "./session-revision";

const NORTE: SessionIdentity = {
  userId: "u1",
  organizationSlug: "norte",
  revision: 0,
  isSettled: true,
};
const SUR: SessionIdentity = { ...NORTE, organizationSlug: "sur" };
const OTHER_USER: SessionIdentity = { ...NORTE, userId: "u2" };
const NEXT_REVISION: SessionIdentity = { ...NORTE, revision: 1 };

function optionsFor(identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, { key: ["things", 1], queryFn: () => Promise.resolve(1) });
}

/** The placeholder the options give for `previous` data that was loaded under `loadedAs`. */
function placeholderFrom(loadedAs: SessionIdentity, current: SessionIdentity) {
  const client = new QueryClient();
  const previousQuery = client.getQueryCache().build<number>(client, {
    queryKey: [...optionsFor(loadedAs).queryKey],
    meta: { revision: loadedAs.revision },
  });
  const { placeholderData } = optionsFor(current);
  if (typeof placeholderData !== "function") throw new TypeError("expected a function");
  return placeholderData(7, previousQuery);
}

describe("orgScopedQueryOptions", () => {
  test("the key starts with the user and the organization", () => {
    expect(optionsFor(NORTE).queryKey).toEqual(["org", "u1", "norte", "things", 1]);
  });

  test("the previous page stays as placeholder within the same identity", () => {
    expect(placeholderFrom(NORTE, NORTE)).toBe(7);
  });

  test.each([
    ["another organization", SUR],
    ["another user", OTHER_USER],
    ["an earlier session revision", NEXT_REVISION],
  ])("never reuses data of %s as placeholder", (_name, current) => {
    expect(placeholderFrom(NORTE, current)).toBeUndefined();
  });

  test("drops an answer that arrives after the session revision changed", async () => {
    let answer: (value: number) => void = () => undefined;
    const late = new Promise<number>((resolve) => {
      answer = resolve;
    });
    const { queryFn } = orgScopedQueryOptions(NORTE, { key: ["things"], queryFn: () => late });
    if (typeof queryFn !== "function") throw new TypeError("expected a function");
    const request = queryFn({ queryKey: [], signal: new AbortController().signal } as never);

    changeIdentity();
    answer(5);

    await expect(request).rejects.toBeInstanceOf(CancelledError);
  });

  test("does not run while the tab waits for /me/ after another tab changed the session", () => {
    expect(optionsFor({ ...NORTE, isSettled: false }).enabled).toBe(false);
    expect(optionsFor(NORTE).enabled).toBe(true);
  });
});

describe("findUnscopedQueries (the guard itself)", () => {
  test.each([
    ["queryOptions with a queryKey", "queryOptions({ queryKey: ['a'], queryFn })"],
    [
      "queryOptions with the shorthand",
      "const queryKey = ['a']; queryOptions({ queryKey, queryFn })",
    ],
    ["useQuery with a queryKey", "useQuery({ queryKey: ['a'], queryFn })"],
    ["a queryKey kept in a variable", "const options = { queryKey: ['a'] }; useQuery(options)"],
    [
      "a placeholderData override",
      "useQuery({ ...phonesQueryOptions(a, b, c), placeholderData: x })",
    ],
    ["keepPreviousData as the override", "useQuery({ ...o, placeholderData: keepPreviousData })"],
    ["keepPreviousData imported", "import { keepPreviousData } from '@tanstack/react-query';"],
  ])("flags %s", (_name, source) => {
    expect(findUnscopedQueries(source)).not.toEqual([]);
  });

  test.each([
    ["a query defined with the helper", "useQuery(phonesQueryOptions(client, identity, state))"],
    ["orgScopedQueryOptions itself", "orgScopedQueryOptions(identity, { key: ['a'], queryFn })"],
    ["invalidateQueries with a filter", "queryClient.invalidateQueries({ queryKey: ['org'] })"],
    ["removeQueries with a filter", "queryClient.removeQueries({ queryKey: ME_QUERY_KEY })"],
    [
      "cancelQueries and setQueryData",
      "client.cancelQueries({ queryKey: k }); client.setQueryData(k, 1)",
    ],
  ])("lets through %s", (_name, source) => {
    expect(findUnscopedQueries(source)).toEqual([]);
  });
});

/**
 * Guard (#82): outside `session/` and `api/` (the `/me/` query and the cache itself) every query
 * is defined with `orgScopedQueryOptions`, so no list can skip the identity in its key, the
 * placeholder rule or the revision check.
 */
describe("org-scoped queries", () => {
  const SRC = join(import.meta.dirname, "..");
  const EXEMPT = ["session", "api", "test"];
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))
    .filter((file) => !EXEMPT.includes(file.split(/[\\/]/)[0] ?? ""));

  test("finds the screens' files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test("no file outside session/ and api/ defines a query by hand", () => {
    const offenders = files.flatMap((file) =>
      findUnscopedQueries(readFileSync(join(SRC, file), "utf8")).map(
        (problem) => `${file}: ${problem}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
