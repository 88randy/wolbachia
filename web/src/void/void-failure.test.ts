import { describe, expect, test, vi } from "vitest";
import { messages } from "@wolbachia/i18n";
import { submitVoid } from "./submit-void";
import { voidFailureKey, voidFailureOf } from "./void-failure";
import type { VoidFailure } from "./void-failure";

function envelope(code: string, fields?: Record<string, { code: string; params: object }[]>) {
  return { code, detail: `Fake ${code}.`, ...(fields ? { fields } : {}) };
}

const TOO_SHORT = (params: object) =>
  envelope("validation_error", { reason: [{ code: "void_reason_too_short", params }] });

describe("voidFailureOf", () => {
  test("reads void_reason_too_short and its min_length param", () => {
    expect(voidFailureOf(400, TOO_SHORT({ min_length: 12 }))).toEqual({
      kind: "reasonTooShort",
      minLength: 12,
    });
  });

  test("keeps the failure when the param is missing or not a number", () => {
    expect(voidFailureOf(400, TOO_SHORT({}))).toEqual({
      kind: "reasonTooShort",
      minLength: undefined,
    });
    expect(voidFailureOf(400, TOO_SHORT({ min_length: "12" }))).toEqual({
      kind: "reasonTooShort",
      minLength: undefined,
    });
  });

  test.each<[number, unknown, VoidFailure]>([
    [
      400,
      envelope("validation_error", { reason: [{ code: "blank", params: {} }] }),
      { kind: "invalid" },
    ],
    [400, undefined, { kind: "invalid" }],
    [403, envelope("permission_denied"), { kind: "permissionDenied" }],
    [404, envelope("not_found"), { kind: "notFound" }],
    [409, envelope("already_voided"), { kind: "alreadyVoided" }],
    [409, envelope("version_not_scheduled"), { kind: "blocked" }],
    [409, undefined, { kind: "blocked" }],
    [429, envelope("throttled"), { kind: "service", failure: "rateLimited" }],
    [500, undefined, { kind: "service", failure: "server" }],
    [502, undefined, { kind: "service", failure: "server" }],
    [418, undefined, { kind: "service", failure: "generic" }],
  ])("%i %j is %j", (status, error, expected) => {
    expect(voidFailureOf(status, error)).toEqual(expected);
  });
});

describe("voidFailureKey", () => {
  test("every failure has a key that exists in both catalogs", () => {
    const failures: VoidFailure[] = [
      { kind: "reasonTooShort", minLength: 10 },
      { kind: "invalid" },
      { kind: "permissionDenied" },
      { kind: "notFound" },
      { kind: "alreadyVoided" },
      { kind: "blocked" },
      { kind: "service", failure: "network" },
    ];

    for (const failure of failures) {
      expect(messages["es-MX"][voidFailureKey(failure)]).toBeTruthy();
      expect(messages["en"][voidFailureKey(failure)]).toBeTruthy();
    }
  });
});

describe("submitVoid", () => {
  test("a 2xx answer is ok", async () => {
    const result = await submitVoid(() =>
      Promise.resolve({ response: new Response(null, { status: 200 }) }),
    );

    expect(result).toEqual({ ok: true });
  });

  test("an error answer becomes a failure read from its body", async () => {
    const result = await submitVoid(() =>
      Promise.resolve({
        response: new Response(null, { status: 409 }),
        error: envelope("already_voided"),
      }),
    );

    expect(result).toEqual({ ok: false, failure: { kind: "alreadyVoided" } });
  });

  test("a thrown network error is a network failure, not an exception", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await submitVoid(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(result).toEqual({ ok: false, failure: { kind: "service", failure: "network" } });
    expect(log).toHaveBeenCalled();
  });
});
