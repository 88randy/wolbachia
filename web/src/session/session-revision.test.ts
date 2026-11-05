import { describe, expect, test } from "vitest";
import {
  bumpEpoch,
  currentRevision,
  isSessionKnown,
  isSignedOutSession,
  sessionState,
  setSessionState,
  setSignedOut,
  subscribeToRevision,
} from "./session-revision";

describe("session epoch and state", () => {
  test("the epoch changes only when it is bumped, and subscribers hear it", () => {
    const start = currentRevision();
    let heard = 0;
    const stop = subscribeToRevision(() => {
      heard += 1;
    });

    bumpEpoch();

    expect(currentRevision()).toBe(start + 1);
    expect(heard).toBe(1);
    stop();
  });

  test("org-scoped work may run only in known", () => {
    expect(isSessionKnown()).toBe(true);

    setSessionState("reconciling");
    expect(sessionState()).toBe("reconciling");
    expect(isSessionKnown()).toBe(false);

    setSessionState("unknown");
    expect(isSessionKnown()).toBe(false);
  });

  test("the signed-out flag is only a flag: it does not change the epoch", () => {
    const epoch = currentRevision();

    setSignedOut(true);
    expect(isSignedOutSession()).toBe(true);
    setSignedOut(false);

    expect(isSignedOutSession()).toBe(false);
    expect(currentRevision()).toBe(epoch);
  });
});
