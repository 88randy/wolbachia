import { afterEach, describe, expect, test, vi } from "vitest";
import { messages } from "@wolbachia/i18n";
import { createAppQueryClient } from "../api/query-client";
import { ME_QUERY_KEY } from "../session/me-query";
import {
  endSessionExpiry,
  isSessionExpired,
  subscribeToMembershipLost,
} from "../session/session-events";
import { makeMe } from "../test/fake-api";
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

  test("reads void_reason_invalid_characters", () => {
    const body = envelope("validation_error", {
      reason: [{ code: "void_reason_invalid_characters", params: {} }],
    });

    expect(voidFailureOf(400, body)).toEqual({ kind: "invalidCharacters" });
  });

  test.each<[number, unknown, VoidFailure]>([
    [
      400,
      envelope("validation_error", { reason: [{ code: "blank", params: {} }] }),
      { kind: "invalid" },
    ],
    [
      400,
      envelope("validation_error", {
        reason_code: [{ code: "void_reason_code_unknown", params: {} }],
      }),
      { kind: "codeUnknown" },
    ],
    [
      400,
      envelope("validation_error", {
        reason: [{ code: "void_reason_required_for_other", params: {} }],
      }),
      { kind: "requiredForOther" },
    ],
    [
      400,
      envelope("validation_error", { reason: [{ code: "max_length", params: {} }] }),
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
      { kind: "codeUnknown" },
      { kind: "requiredForOther" },
      { kind: "invalid" },
      { kind: "invalidCharacters" },
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
  function client() {
    const queryClient = createAppQueryClient({ retry: false });
    queryClient.setQueryData(ME_QUERY_KEY, makeMe()); // someone is signed in
    return queryClient;
  }
  const answer = (status: number, error?: unknown) =>
    Promise.resolve({ response: new Response(null, { status }), error });

  afterEach(() => {
    endSessionExpiry();
  });

  test("a 2xx answer is ok", async () => {
    expect(await submitVoid(client(), () => answer(200))).toEqual({ ok: true });
  });

  test("an error answer becomes a failure read from its body", async () => {
    const result = await submitVoid(client(), () => answer(409, envelope("already_voided")));

    expect(result).toEqual({ ok: false, failure: { kind: "alreadyVoided" } });
  });

  test("a 401 reports the expired session, so the re-authentication dialog opens", async () => {
    await submitVoid(client(), () => answer(401, envelope("not_authenticated")));

    expect(isSessionExpired()).toBe(true);
  });

  test("a 403 no_active_membership reports the lost membership; another 403 does not", async () => {
    const lost = vi.fn();
    const unsubscribe = subscribeToMembershipLost(lost);

    await submitVoid(client(), () => answer(403, envelope("permission_denied")));
    expect(lost).not.toHaveBeenCalled();
    await submitVoid(client(), () => answer(403, envelope("no_active_membership")));
    unsubscribe();

    expect(lost).toHaveBeenCalledTimes(1);
  });

  test("a thrown network error is a network failure, not an exception", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await submitVoid(client(), () => Promise.reject(new TypeError("Failed")));

    expect(result).toEqual({ ok: false, failure: { kind: "service", failure: "network" } });
    expect(log).toHaveBeenCalled();
  });
});
