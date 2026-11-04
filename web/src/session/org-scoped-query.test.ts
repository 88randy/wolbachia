import { QueryClient } from "@tanstack/react-query";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { orgScopedQueryOptions } from "./org-scoped-query";
import type { SessionIdentity } from "./org-scoped-query";

const NORTE: SessionIdentity = { userId: "u1", organizationSlug: "norte" };
const SUR: SessionIdentity = { userId: "u1", organizationSlug: "sur" };
const OTHER_USER: SessionIdentity = { userId: "u2", organizationSlug: "norte" };

function optionsFor(identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, { key: ["things", 1], queryFn: () => Promise.resolve(1) });
}

/** The placeholder the options give for `previous` data that was loaded under `loadedAs`. */
function placeholderFrom(loadedAs: SessionIdentity, current: SessionIdentity) {
  const client = new QueryClient();
  const previousQuery = client
    .getQueryCache()
    .build<number>(client, { queryKey: [...optionsFor(loadedAs).queryKey] });
  const { placeholderData } = optionsFor(current);
  if (typeof placeholderData !== "function") throw new TypeError("expected a function");
  return placeholderData(7, previousQuery);
}

describe("orgScopedQueryOptions", () => {
  test("the key starts with the session identity", () => {
    expect(optionsFor(NORTE).queryKey).toEqual(["org", "u1", "norte", "things", 1]);
  });

  test("the previous page stays as placeholder within the same identity", () => {
    expect(placeholderFrom(NORTE, NORTE)).toBe(7);
  });

  test.each([
    ["another organization", SUR],
    ["another user", OTHER_USER],
  ])("never reuses data of %s as placeholder", (_name, current) => {
    expect(placeholderFrom(NORTE, current)).toBeUndefined();
  });
});

/**
 * Guard (#82): a query defined with a bare `queryKey:` has no identity in its key and keeps the
 * previous organization's rows as placeholder. Outside `session/` and `api/` (the `/me/` query
 * and the cache itself) every query goes through `orgScopedQueryOptions`.
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

  test("no file outside session/ and api/ defines a query key by hand", () => {
    const offenders = files.filter((file) =>
      /\bqueryKey\s*:|\buseQuery\(\{[^}]*queryKey/.test(readFileSync(join(SRC, file), "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
