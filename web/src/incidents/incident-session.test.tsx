import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createApiClient } from "@wolbachia/api-client";
import { useIncidentUpload } from "./use-incident-upload";
import { uploadIncidentEvidence } from "./incident-evidence";
const session = vi.hoisted(() => ({ revision: 1 }));
vi.mock("../session/use-session-guard", () => ({
  useSessionGuard: () => () => {
    const revision = session.revision;
    return { signal: new AbortController().signal, isStale: () => revision !== session.revision };
  },
}));
vi.mock("./incident-evidence", () => ({
  uploadIncidentEvidence: vi.fn(),
  isEvidenceFile: () => true,
}));
afterEach(() => {
  vi.restoreAllMocks();
  session.revision = 1;
});
const client = createApiClient({
  baseUrl: "https://test.invalid",
  auth: { kind: "session", getCsrfToken: () => undefined },
});
function wrapper({ children }: { children: ReactNode }) {
  const cache = new QueryClient();
  return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
}
test("a retired upload releases busy state and its late reply cannot verify the next attempt", async () => {
  let release: (proof: { uploadId: string; verifiedAt: string }) => void = () => undefined;
  const held = new Promise<{ uploadId: string; verifiedAt: string }>((resolve) => {
    release = resolve;
  });
  vi.mocked(uploadIncidentEvidence).mockImplementationOnce(async (call) => {
    call.onAuthorized("upload-1");
    return held;
  });
  let releaseSecond: (proof: { uploadId: string; verifiedAt: string }) => void = () => undefined;
  const retryHeld = new Promise<{ uploadId: string; verifiedAt: string }>((resolve) => {
    releaseSecond = resolve;
  });
  vi.mocked(uploadIncidentEvidence).mockImplementationOnce(() => retryHeld);
  const onVerified = vi.fn();
  const { result, rerender } = renderHook(
    ({ revision }) =>
      useIncidentUpload(
        {
          client,
          identity: { userId: "user", organizationSlug: "org", revision, isSettled: true },
        },
        { id: "incident-1", onVerified },
      ),
    { wrapper, initialProps: { revision: 1 } },
  );
  act(() => {
    result.current.select(new File(["test"], "proof.png", { type: "image/png" }));
  });
  let first: Promise<void> = Promise.resolve();
  act(() => {
    first = result.current.upload();
  });
  expect(result.current.isBusy).toBe(true);
  act(() => {
    session.revision = 2;
    rerender({ revision: 2 });
  });
  expect(result.current.isBusy).toBe(false);
  expect(result.current.hasFailed).toBe(true);
  let second: Promise<void> = Promise.resolve();
  act(() => {
    second = result.current.upload();
  });
  expect(result.current.isBusy).toBe(true);
  await act(async () => {
    release({ uploadId: "upload-1", verifiedAt: "2026-11-01T12:00:00Z" });
    await first;
  });
  expect(onVerified).not.toHaveBeenCalled();
  expect(result.current.isBusy).toBe(true);
  expect(result.current.proof?.verifiedAt).toBeUndefined();
  await act(async () => {
    releaseSecond({ uploadId: "upload-1", verifiedAt: "2026-11-01T12:00:00Z" });
    await second;
  });
  expect(onVerified).toHaveBeenCalledWith("upload-1");
  expect(result.current.proof?.verifiedAt).toBe("2026-11-01T12:00:00Z");
});
