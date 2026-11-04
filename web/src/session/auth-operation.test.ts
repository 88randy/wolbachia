import { describe, expect, test } from "vitest";
import {
  abandonAuthOperation,
  finishAuthOperation,
  isCurrentOperation,
  startAuthOperation,
} from "./auth-operation";

describe("auth operations", () => {
  test("only one runs at a time, until its request settles", () => {
    const first = startAuthOperation("login");

    expect(first).toBeDefined();
    expect(startAuthOperation("logout")).toBeUndefined();
    finishAuthOperation(first?.token ?? -1);
    expect(startAuthOperation("logout")).toBeDefined();
  });

  test("abandoning aborts the request and ignores the result, but keeps the lock", () => {
    const login = startAuthOperation("login");
    const token = login?.token ?? -1;

    abandonAuthOperation(token);

    expect(login?.signal.aborted).toBe(true);
    expect(isCurrentOperation(token)).toBe(false);
    expect(startAuthOperation("login")).toBeUndefined();
    finishAuthOperation(token);
    expect(startAuthOperation("login")).toBeDefined();
  });

  test("a stale token cannot release a newer operation", () => {
    const first = startAuthOperation("login");
    finishAuthOperation(first?.token ?? -1);
    const second = startAuthOperation("logout");

    finishAuthOperation(first?.token ?? -1);

    expect(isCurrentOperation(second?.token ?? -1)).toBe(true);
    expect(startAuthOperation("login")).toBeUndefined();
  });
});
