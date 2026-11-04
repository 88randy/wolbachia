import { describe, expect, test } from "vitest";
import {
  acceptSession,
  confirmSignOut,
  currentRevision,
  isSignedOutSession,
} from "./session-revision";

describe("session revision", () => {
  test("changes only on an accepted login and a confirmed sign-out", () => {
    const start = currentRevision();

    expect(currentRevision()).toBe(start);
    const afterLogin = acceptSession();
    const afterLogout = confirmSignOut();

    expect(afterLogin).toBe(start + 1);
    expect(afterLogout).toBe(start + 2);
    expect(currentRevision()).toBe(afterLogout);
  });

  test("is signed out from a confirmed sign-out until the next accepted login", () => {
    expect(isSignedOutSession()).toBe(false);

    confirmSignOut();
    expect(isSignedOutSession()).toBe(true);

    acceptSession();
    expect(isSignedOutSession()).toBe(false);
  });
});
