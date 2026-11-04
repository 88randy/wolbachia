import { describe, expect, test } from "vitest";
import { runAuthOperation } from "./auth-operation";

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("auth operations are queued, never rejected", () => {
  test("a new one waits for the previous one to settle, then runs", async () => {
    const order: string[] = [];
    const first = deferred();
    const one = runAuthOperation("logout", async () => {
      order.push("first starts");
      await first.promise;
      order.push("first ends");
    });
    const two = runAuthOperation("login", () => {
      order.push("second starts");
      return Promise.resolve();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["first starts"]);
    first.release();
    await Promise.all([one.result, two.result]);

    expect(order).toEqual(["first starts", "first ends", "second starts"]);
  });

  test("a task that throws does not stop the queue", async () => {
    const failing = runAuthOperation("logout", () => {
      throw new Error("boom");
    });
    const next = runAuthOperation("login", () => Promise.resolve("ran"));

    await expect(failing.result).rejects.toThrow("boom");

    await expect(next.result).resolves.toBe("ran");
  });
});

describe("generations and abandonment", () => {
  test("a login queued before a sign-out is superseded: its result must be ignored", async () => {
    const gate = deferred();
    let isCurrentAtEnd: boolean | undefined;
    const blocker = runAuthOperation("login", () => gate.promise);
    const login = runAuthOperation("login", (context) => {
      isCurrentAtEnd = context.isCurrent();
      return Promise.resolve();
    });
    runAuthOperation("logout", () => Promise.resolve());

    gate.release();
    await blocker.result;
    await login.result;

    // It was superseded while queued, so it did not even run.
    expect(isCurrentAtEnd).toBeUndefined();
  });

  test("a login queued after a sign-out runs", async () => {
    runAuthOperation("logout", () => Promise.resolve());
    const login = runAuthOperation("login", (context) => Promise.resolve(context.isCurrent()));

    await expect(login.result).resolves.toBe(true);
  });

  test("an abandoned login that has not started never runs, and its signal is aborted", async () => {
    const gate = deferred();
    runAuthOperation("login", () => gate.promise);
    let ran = false;
    const abandoned = runAuthOperation("login", () => {
      ran = true;
      return Promise.resolve();
    });

    abandoned.abandon();
    gate.release();
    await abandoned.result;

    expect(ran).toBe(false);
  });

  test("abandoning a running login aborts its signal and marks its result as stale", async () => {
    const gate = deferred();
    let seen: { aborted: boolean; current: boolean } | undefined;
    const login = runAuthOperation("login", async (context) => {
      await gate.promise;
      seen = { aborted: context.signal.aborted, current: context.isCurrent() };
    });

    await Promise.resolve();
    login.abandon();
    gate.release();
    await login.result;

    expect(seen).toEqual({ aborted: true, current: false });
  });

  test("a sign-out is never abandoned", async () => {
    const gate = deferred();
    let seen: { aborted: boolean; current: boolean } | undefined;
    const logout = runAuthOperation("logout", async (context) => {
      await gate.promise;
      seen = { aborted: context.signal.aborted, current: context.isCurrent() };
    });

    logout.abandon();
    gate.release();
    await logout.result;

    expect(seen).toEqual({ aborted: false, current: true });
  });
});
