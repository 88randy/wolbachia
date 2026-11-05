import { describe, expect, test } from "vitest";
import { createAppQueryClient } from "../api/query-client";
import { makeMe } from "../test/fake-api";
import { expectedAttestation, setExpectedAttestation } from "./attestation";
import { isRecordedIdentity } from "./identity";
import { ME_QUERY_KEY } from "./me-key";
import { getOrganizationSlug, setOrganizationSlug } from "./organization-slug";
import {
  begin,
  commitKnown,
  commitSignedOut,
  failIfCurrent,
  leaveKnown,
} from "./session-controller";
import { bumpEpoch, currentRevision, sessionState } from "./session-revision";

const ME = makeMe();
const CANDIDATE = { me: ME, attestation: "attested-A", slug: "norte" };

function freshClient() {
  return createAppQueryClient({ retry: false });
}

describe("commitKnown", () => {
  test("a current token publishes everything in one step", () => {
    const queryClient = freshClient();
    const token = begin(queryClient, "leave");
    expect(sessionState()).toBe("reconciling");

    const isCommitted = commitKnown(queryClient, token, CANDIDATE);

    expect(isCommitted).toBe(true);
    expect(sessionState()).toBe("known");
    expect(expectedAttestation()).toBe("attested-A");
    expect(getOrganizationSlug()).toBe("norte");
    expect(isRecordedIdentity(queryClient, ME.user.id, ME.organization?.slug ?? "")).toBe(true);
    expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(ME);
  });

  test("a STALE token publishes nothing: no state, slug, identity, attestation or cache entry", () => {
    const queryClient = freshClient();
    setOrganizationSlug("before");
    const token = begin(queryClient, "leave");
    setExpectedAttestation("before");
    bumpEpoch(); // another operation took over

    const isCommitted = commitKnown(queryClient, token, CANDIDATE);

    expect(isCommitted).toBe(false);
    expect(sessionState()).toBe("reconciling");
    expect(getOrganizationSlug()).toBe("before");
    expect(expectedAttestation()).toBe("before");
    expect(isRecordedIdentity(queryClient, ME.user.id, ME.organization?.slug ?? "")).toBe(false);
    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeUndefined();
  });

  test("a login (replace, bumpEpoch) clears the cache and invalidates the tokens before it", () => {
    const queryClient = freshClient();
    queryClient.setQueryData(["org", "x", "y", "devices"], ["old"]);
    const token = begin(queryClient, "passive");
    const other = currentRevision();

    commitKnown(queryClient, token, { ...CANDIDATE, replace: true, bumpEpoch: true });

    expect(queryClient.getQueryData(["org", "x", "y", "devices"])).toBeUndefined();
    expect(currentRevision()).toBe(other + 1);
  });
});

describe("failures and the transitions never restore anything", () => {
  test("a failed CURRENT operation leaves known; a stale one does nothing", async () => {
    const queryClient = freshClient();
    const stale = begin(queryClient, "leave");
    const current = begin(queryClient, "leave");
    expect(current.epoch).toBe(currentRevision());

    await failIfCurrent(queryClient, stale);
    expect(sessionState()).toBe("reconciling");

    await failIfCurrent(queryClient, current);
    expect(sessionState()).toBe("unknown");
  });

  test("leaveKnown always bumps the epoch, so it kills every token in flight", async () => {
    const queryClient = freshClient();
    const token = begin(queryClient, "passive");

    await leaveKnown(queryClient);

    expect(currentRevision()).toBe(token.epoch + 1);
    expect(commitKnown(queryClient, token, CANDIDATE)).toBe(false);
  });

  test("a sign-out with a stale token publishes nothing and forgets no slug", () => {
    const queryClient = freshClient();
    setOrganizationSlug("norte");
    const token = begin(queryClient, "passive");
    bumpEpoch();

    expect(commitSignedOut(queryClient, token)).toBeUndefined();
    expect(getOrganizationSlug()).toBe("norte");
  });
});

describe("only the latest begun operation can commit", () => {
  test("every begin returns a token of its own, even with no epoch change", () => {
    const queryClient = freshClient();
    const first = begin(queryClient, "passive");
    const second = begin(queryClient, "verify");
    expect(second.operation).not.toBe(first.operation);
    expect(commitKnown(queryClient, first, CANDIDATE)).toBe(false);
    expect(commitKnown(queryClient, second, CANDIDATE)).toBe(true);
  });

  test("a token that is not the latest is rejected, even one begun in the same epoch", () => {
    const queryClient = freshClient();
    setOrganizationSlug("previous");
    const login = begin(queryClient, "leave");
    const verify = begin(queryClient, "verify"); // same epoch, newer operation
    expect(commitKnown(queryClient, login, CANDIDATE)).toBe(false);
    expect(commitSignedOut(queryClient, login)).toBeUndefined();
    expect(getOrganizationSlug()).toBe("previous"); // the rejected commit wrote nothing
    expect(commitKnown(queryClient, verify, CANDIDATE)).toBe(true);
  });
});
