import { describe, expect, test } from "vitest";
import {
  acceptSession,
  confirmSignOut,
  currentRevision,
  isSignedOutSession,
  recoverSession,
} from "./session-revision";

describe("session revision", () => {
  test("changes only on an accepted login and a confirmed sign-out", () => {
    const start = currentRevision();

    acceptSession();
    expect(currentRevision()).toBe(start + 1);
    expect(confirmSignOut()).toBe(start + 2);
    expect(currentRevision()).toBe(start + 2);
  });

  test("recovering from a valid /me/ leaves the signed-out state without changing the revision", () => {
    confirmSignOut();
    const revision = currentRevision();

    recoverSession();

    expect(isSignedOutSession()).toBe(false);
    expect(currentRevision()).toBe(revision);
  });

  test("is signed out from a confirmed sign-out until the next accepted login", () => {
    expect(isSignedOutSession()).toBe(false);

    confirmSignOut();
    expect(isSignedOutSession()).toBe(true);

    acceptSession();
    expect(isSignedOutSession()).toBe(false);
  });
});
