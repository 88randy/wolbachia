import { createElement } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createApiClient } from "@wolbachia/api-client";
import { expect, test, vi } from "vitest";
import { uploadTransferEvidence } from "./transfer-evidence";
import type { TransferUpload } from "./transfer-evidence";
import { useTransferUpload } from "./use-transfer-upload";
import type { TransferUploadScope } from "./use-transfer-upload";

const UPLOAD_ID = "00000000-0000-4000-8000-000000000034";
const VERIFIED_AT = "2026-11-01T11:00:00Z";
function fileProof(): TransferUpload {
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = new File([bytes], "proof.png", { type: "image/png" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(bytes.buffer.slice(0)),
  });
  return { file, clientId: "00000000-0000-4000-8000-000000000035" };
}
function uploadServer(finalize: () => Promise<Response>) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const grant = {
    upload_id: UPLOAD_ID,
    url: `/api/v1/field/uploads/${UPLOAD_ID}/content/`,
    method: "PUT",
    headers: { "Content-Type": "image/png", "Upload-Lease": "synthetic-lease" },
    expires_at: "2026-11-01T12:00:00Z",
  };
  const client = createApiClient({
    baseUrl: "https://test.invalid",
    auth: { kind: "session", getCsrfToken: () => "test-csrf" },
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      const body: unknown =
        request.method === "PUT"
          ? Array.from(new Uint8Array(await request.arrayBuffer()))
          : await request.json().catch(() => null);
      requests.push({ method: request.method, path, body });
      if (request.method === "PUT") return new Response(null, { status: 204 });
      if (path.endsWith("/finalize/")) return finalize();
      if (path.endsWith("/renew/"))
        return Response.json({
          ...grant,
          id: UPLOAD_ID,
          state: "verified",
          verified_at: VERIFIED_AT,
        });
      return Response.json(grant, { status: 201 });
    },
  });
  return { client, requests };
}
function uploadScope(client: TransferUploadScope["client"]): TransferUploadScope {
  return {
    client,
    identity: {
      userId: "operator",
      organizationSlug: "test",
      activeCenter: "",
      revision: 0,
      isSettled: true,
      permissions: ["field.upload"],
    },
    isCurrentRead: () => true,
    beginWrite: () => ({ signal: new AbortController().signal, isStale: () => false }),
  };
}

test("unbound evidence preserves bytes and renews its exact UUID after a lost finalization response", async () => {
  const { client, requests } = uploadServer(() => Promise.reject(new TypeError("Lost finalize")));
  let evidence = fileProof();
  const call = () => ({
    client,
    evidence,
    signal: new AbortController().signal,
    requireCurrent: () => undefined,
    onAuthorized: (uploadId: string) => {
      evidence = { ...evidence, uploadId };
    },
  });
  await expect(uploadTransferEvidence(call())).rejects.toThrow("Lost finalize");
  expect(requests.find((request) => request.path === "/api/v1/field/uploads/")?.body).toMatchObject(
    { client_id: evidence.clientId },
  );
  expect(
    requests.find((request) => request.path === "/api/v1/field/uploads/")?.body,
  ).not.toHaveProperty("context");
  expect(requests.find((request) => request.path.endsWith("/finalize/"))?.body).toEqual({});
  expect(requests.find((request) => request.method === "PUT")?.body).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(await uploadTransferEvidence(call())).toEqual({
    uploadId: UPLOAD_ID,
    verifiedAt: VERIFIED_AT,
  });
  expect(requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  expect(requests.filter((request) => request.path === "/api/v1/field/uploads/")).toHaveLength(1);
});

test("pending and stale finalization answers cannot become verified transfer evidence", async () => {
  const pending = uploadServer(() =>
    Promise.resolve(Response.json({ id: UPLOAD_ID, state: "pending", verified_at: null })),
  );
  const call = {
    client: pending.client,
    evidence: fileProof(),
    signal: new AbortController().signal,
    requireCurrent: () => undefined,
    onAuthorized: () => undefined,
  };
  await expect(uploadTransferEvidence(call)).rejects.toThrow("Unverified transfer evidence");
  let release: (response: Response) => void = () => undefined;
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const late = uploadServer(() => reply);
  let isStale = false;
  const uploading = uploadTransferEvidence({
    ...call,
    client: late.client,
    requireCurrent: () => {
      if (isStale) throw new Error("Stale transfer upload");
    },
  });
  await vi.waitFor(() => {
    expect(late.requests.some((request) => request.path.endsWith("/finalize/"))).toBe(true);
  });
  isStale = true;
  release(Response.json({ id: UPLOAD_ID, state: "verified", verified_at: VERIFIED_AT }));
  await expect(uploading).rejects.toThrow("Stale transfer upload");
});

test("replacing a verified image retires the parent proof before the replacement is uploaded", async () => {
  const { client, requests } = uploadServer(() =>
    Promise.resolve(Response.json({ id: UPLOAD_ID, state: "verified", verified_at: VERIFIED_AT })),
  );
  const cache = new QueryClient();
  const onVerified = vi.fn();
  const { result } = renderHook(() => useTransferUpload(uploadScope(client), onVerified), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client: cache }, children),
  });
  act(() => {
    result.current.select(fileProof().file);
  });
  await act(async () => {
    await result.current.upload();
  });
  expect(onVerified).toHaveBeenLastCalledWith(UPLOAD_ID);
  act(() => {
    result.current.select(fileProof().file);
  });
  expect(onVerified).toHaveBeenLastCalledWith("");
  expect(result.current.proof?.verifiedAt).toBeUndefined();
  expect(requests.filter((request) => request.path === "/api/v1/field/uploads/")).toHaveLength(1);
  cache.clear();
});

test("a deferred upload publishes through the latest callback without restoring an earlier parent draft", async () => {
  let release: (response: Response) => void = () => undefined;
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { client, requests } = uploadServer(() => reply);
  const scope = uploadScope(client);
  const cache = new QueryClient();
  const originalCallback = vi.fn<(id: string) => void>();
  const currentCallback = vi.fn<(id: string) => void>();
  const { result, rerender } = renderHook(
    ({ onVerified }) => useTransferUpload(scope, onVerified),
    {
      initialProps: { onVerified: originalCallback },
      wrapper: ({ children }) => createElement(QueryClientProvider, { client: cache }, children),
    },
  );
  act(() => {
    result.current.select(fileProof().file);
  });
  originalCallback.mockClear();
  let uploading: Promise<void> = Promise.resolve();
  await act(async () => {
    uploading = result.current.upload();
    await vi.waitFor(() => {
      expect(requests.some((request) => request.path.endsWith("/finalize/"))).toBe(true);
    });
  });
  rerender({ onVerified: currentCallback });
  await act(async () => {
    release(Response.json({ id: UPLOAD_ID, state: "verified", verified_at: VERIFIED_AT }));
    await uploading;
  });
  expect(originalCallback).not.toHaveBeenCalled();
  expect(currentCallback).toHaveBeenCalledExactlyOnceWith(UPLOAD_ID);
  cache.clear();
});

test("an uploader removed by an outcome-mode change cannot publish its late verified signature", async () => {
  let release: (response: Response) => void = () => undefined;
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { client, requests } = uploadServer(() => reply);
  const cache = new QueryClient();
  const onVerified = vi.fn<(id: string) => void>();
  const { result, unmount } = renderHook(() => useTransferUpload(uploadScope(client), onVerified), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client: cache }, children),
  });
  act(() => {
    result.current.select(fileProof().file);
  });
  onVerified.mockClear();
  let uploading: Promise<void> = Promise.resolve();
  await act(async () => {
    uploading = result.current.upload();
    await vi.waitFor(() => {
      expect(requests.some((request) => request.path.endsWith("/finalize/"))).toBe(true);
    });
  });
  unmount();
  await act(async () => {
    release(Response.json({ id: UPLOAD_ID, state: "verified", verified_at: VERIFIED_AT }));
    await uploading;
  });
  expect(onVerified).not.toHaveBeenCalled();
  cache.clear();
});
