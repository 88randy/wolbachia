import { webcrypto } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { createApiClient } from "@wolbachia/api-client";
import { uploadCertificateEvidence } from "./certificate-evidence";
import type { TrainingScope } from "./training-query";
const UPLOAD = "00000000-0000-4000-8000-000000000301";
const IMAGE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
afterEach(() => {
  vi.unstubAllGlobals();
});
function imageFile() {
  return {
    size: IMAGE.length,
    type: "image/png",
    arrayBuffer: () => Promise.resolve(IMAGE.buffer),
  } as File;
}
function makeUploadScope(
  options: { invalidUrl?: boolean; state?: "verified" | "received"; onAuthorize?: () => void } = {},
) {
  const bodies: { path: string; body: unknown; headers: Headers }[] = [];
  const fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const body: unknown =
      request.method === "PUT"
        ? new Uint8Array(await request.arrayBuffer())
        : JSON.parse(await request.text());
    bodies.push({ path, body, headers: request.headers });
    if (path.endsWith("/uploads/")) {
      options.onAuthorize?.();
      return Response.json(
        {
          upload_id: UPLOAD,
          url: options.invalidUrl
            ? "https://foreign.example.test/content"
            : `/api/v1/field/uploads/${UPLOAD}/content/`,
          method: "PUT",
          headers: { "Content-Type": "image/png", "Upload-Lease": "synthetic-lease" },
          expires_at: "2026-11-09T12:15:00Z",
        },
        { status: 201 },
      );
    }
    if (request.method === "PUT") return new Response(null, { status: 204 });
    return Response.json({
      id: UPLOAD,
      state: options.state ?? "verified",
      verified_at: options.state === "received" ? null : "2026-11-09T12:01:00Z",
    });
  };
  const scope: TrainingScope = {
    client: createApiClient({
      baseUrl: "https://api.example.test",
      auth: { kind: "session", getCsrfToken: () => "synthetic-csrf" },
      fetch,
    }),
    identity: {
      userId: "synthetic-user",
      organizationSlug: "synthetic-org",
      revision: 0,
      isSettled: true,
    },
  };
  return { scope, bodies };
}
async function upload(scope: TrainingScope, requireCurrent = () => undefined) {
  vi.stubGlobal("crypto", webcrypto);
  return uploadCertificateEvidence({
    scope,
    evidence: { file: imageFile(), clientId: "00000000-0000-4000-8000-000000000302" },
    signal: new AbortController().signal,
    requireCurrent,
    onAuthorized: () => undefined,
  });
}
test("certification evidence sends original bytes unbound and exposes only a verified server identity", async () => {
  const { scope, bodies } = makeUploadScope();
  expect(await upload(scope)).toEqual({ uploadId: UPLOAD, verifiedAt: "2026-11-09T12:01:00Z" });
  expect(bodies[0]?.body).toMatchObject({
    content_type: "image/png",
    size_bytes: IMAGE.length,
    client_id: "00000000-0000-4000-8000-000000000302",
  });
  expect(bodies[0]?.body).not.toHaveProperty("context");
  expect(bodies[1]?.body).toEqual(IMAGE);
  expect(bodies[1]?.headers.get("Upload-Lease")).toBe("synthetic-lease");
  expect(bodies[2]?.body).toEqual({});
});
test("a foreign upload URL is rejected before any bytes leave the authenticated API", async () => {
  const { scope, bodies } = makeUploadScope({ invalidUrl: true });
  await expect(upload(scope)).rejects.toThrow("Invalid certification upload authority");
  expect(bodies).toHaveLength(1);
});
test("an unverified finalize response never becomes certification evidence", async () => {
  const { scope } = makeUploadScope({ state: "received" });
  await expect(upload(scope)).rejects.toThrow("Unverified certification image");
});
test("scope loss during authorization prevents PUT and finalize", async () => {
  let isCurrent = true;
  const { scope, bodies } = makeUploadScope({
    onAuthorize: () => {
      isCurrent = false;
    },
  });
  await expect(
    upload(scope, () => {
      if (!isCurrent) throw new Error("Stale certification upload");
    }),
  ).rejects.toThrow("Stale certification upload");
  expect(bodies).toHaveLength(1);
});
