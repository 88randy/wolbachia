import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AUTH_REQUEST_TIMEOUT_MS, withAuthTimeout } from "./auth-timeout";

const originalAny = Object.getOwnPropertyDescriptor(AbortSignal, "any");

/** The timeout signal is replaced by one the test fires; the real one lasts 15 s. */
function stubTimeout() {
  const controller = new AbortController();
  const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  return {
    fireTimeout: () => {
      controller.abort();
    },
    spy,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalAny) Object.defineProperty(AbortSignal, "any", originalAny);
});

describe("withAuthTimeout with AbortSignal.any", () => {
  test("aborts when the operation signal aborts", () => {
    stubTimeout();
    const operation = new AbortController();
    const combined = withAuthTimeout(operation.signal);

    operation.abort();

    expect(combined.aborted).toBe(true);
  });

  test("aborts when the timeout fires, and asks for the configured duration", () => {
    const { fireTimeout, spy } = stubTimeout();
    const combined = withAuthTimeout(new AbortController().signal);

    fireTimeout();

    expect(combined.aborted).toBe(true);
    expect(spy).toHaveBeenCalledWith(AUTH_REQUEST_TIMEOUT_MS);
  });

  test("without an operation signal it is just the timeout", () => {
    const { fireTimeout } = stubTimeout();
    const combined = withAuthTimeout();

    expect(combined.aborted).toBe(false);
    fireTimeout();
    expect(combined.aborted).toBe(true);
  });
});

describe("withAuthTimeout without AbortSignal.any (older browsers)", () => {
  beforeEach(() => {
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true });
  });

  test("really runs the manual fallback", () => {
    expect(typeof AbortSignal.any).not.toBe("function");
  });

  test("aborts when the operation signal aborts", () => {
    stubTimeout();
    const operation = new AbortController();
    const combined = withAuthTimeout(operation.signal);
    expect(combined.aborted).toBe(false);

    operation.abort();

    expect(combined.aborted).toBe(true);
  });

  test("aborts when the timeout fires", () => {
    const { fireTimeout } = stubTimeout();
    const combined = withAuthTimeout(new AbortController().signal);
    expect(combined.aborted).toBe(false);

    fireTimeout();

    expect(combined.aborted).toBe(true);
  });

  test("is already aborted when the operation signal already was", () => {
    stubTimeout();
    const operation = new AbortController();
    operation.abort();

    expect(withAuthTimeout(operation.signal).aborted).toBe(true);
  });

  test("without an operation signal it is just the timeout", () => {
    const { fireTimeout } = stubTimeout();
    const combined = withAuthTimeout();

    fireTimeout();

    expect(combined.aborted).toBe(true);
  });
});
