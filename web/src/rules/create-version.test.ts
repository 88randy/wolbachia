import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { isSessionExpired } from "../session/session-events";
import { ME_QUERY_KEY } from "../session/me-query";
import { createVersion, fieldIssuesOf } from "./create-version";
import type { VersionOutcome } from "./create-version";

type Fields = Parameters<typeof fieldIssuesOf>[0]["fields"];

const envelope = (fields: Fields) => ({ code: "validation_error", detail: "Fake.", fields });
const issue = (code: string, params: Record<string, unknown> = {}) => [{ code, params }];

describe("fieldIssuesOf (codes of docs/api-conventions.md, Rule parameters)", () => {
  test.each([
    {
      apiField: "value",
      code: "not_an_integer",
      formField: "value",
      key: "rules.error.notInteger",
    },
    {
      apiField: "effective_from",
      code: "effective_from_in_past",
      formField: "effectiveFrom",
      key: "rules.error.dateInPast",
    },
    {
      apiField: "effective_from",
      code: "effective_from_too_far",
      formField: "effectiveFrom",
      key: "rules.error.dateTooFar",
    },
    {
      apiField: "effective_from",
      code: "duplicate_effective_date",
      formField: "effectiveFrom",
      key: "rules.error.dateTaken",
    },
    {
      apiField: "effective_from",
      code: "invalid",
      formField: "effectiveFrom",
      key: "rules.error.dateRequired",
    },
    {
      apiField: "reason",
      code: "max_length",
      formField: "reason",
      key: "rules.error.reasonTooLong",
    },
    { apiField: "reason", code: "blank", formField: "reason", key: "rules.error.reasonRequired" },
    { apiField: "value", code: "max_digits", formField: "value", key: "rules.error.valueInvalid" },
  ])("$apiField $code is shown under $formField as $key", ({ apiField, code, formField, key }) => {
    const issues = fieldIssuesOf(envelope({ [apiField]: issue(code) }));

    expect(issues).toEqual({ [formField]: { key } });
  });

  test("out_of_range carries the limits the server sent and names the ones that exist", () => {
    const both = fieldIssuesOf(envelope({ value: issue("out_of_range", { min: 1, max: 10 }) }));
    const onlyMax = fieldIssuesOf(
      envelope({ value: issue("out_of_range", { min: null, max: 9 }) }),
    );

    expect(both.value).toEqual({ key: "rules.error.range", bounds: { min: 1, max: 10 } });
    expect(onlyMax.value).toEqual({
      key: "rules.error.atMost",
      bounds: { min: null, max: 9 },
    });
  });

  test("a field the form does not have is left out", () => {
    expect(fieldIssuesOf(envelope({ organization_id: issue("invalid") }))).toEqual({});
  });
});

function answer(status: number, error?: unknown) {
  return () => Promise.resolve({ response: new Response(null, { status }), error });
}

async function outcomeOf(call: () => Promise<{ response: Response; error?: unknown }>) {
  return createVersion(new QueryClient(), call, () => false);
}

describe("createVersion with a session that changed", () => {
  test("regression: a late 401 of a closed session is dropped, not reported to the new one", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ME_QUERY_KEY, { user: { id: "B" } });
    const late = answer(401, { code: "not_authenticated", detail: "Fake." });

    const outcome = await createVersion(queryClient, late, () => true);

    expect(outcome).toEqual({ ok: false, reason: "stale" });
    expect(isSessionExpired()).toBe(false);
  });

  test("an aborted request of a closed session is dropped without a log", async () => {
    const aborted = () => Promise.reject(new DOMException("Aborted", "AbortError"));

    expect(await createVersion(new QueryClient(), aborted, () => true)).toEqual({
      ok: false,
      reason: "stale",
    });
  });
});

describe("createVersion", () => {
  test("a created version is ok", async () => {
    expect(await outcomeOf(answer(201))).toEqual({ ok: true });
  });

  test.each<[number, unknown, VersionOutcome]>([
    [
      400,
      envelope({ value: issue("not_an_integer") }),
      { ok: false, reason: "fields", issues: { value: { key: "rules.error.notInteger" } } },
    ],
    [
      403,
      { code: "permission_denied", detail: "Fake." },
      { ok: false, reason: "permissionDenied" },
    ],
    [404, { code: "not_found", detail: "Fake." }, { ok: false, reason: "notFound" }],
    [
      500,
      { code: "server_error", detail: "Fake." },
      { ok: false, reason: "service", failure: "server" },
    ],
    [
      429,
      { code: "throttled", detail: "Fake." },
      { ok: false, reason: "service", failure: "rateLimited" },
    ],
    [
      400,
      { code: "parse_error", detail: "Fake." },
      { ok: false, reason: "service", failure: "generic" },
    ],
  ])("status %i is read as %j", async (status, error, expected) => {
    expect(await outcomeOf(answer(status, error))).toEqual(expected);
  });

  test("a network failure is a service failure, not an exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const outcome = await outcomeOf(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(outcome).toEqual({ ok: false, reason: "service", failure: "network" });
  });
});
