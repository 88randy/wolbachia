import { webcrypto } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { createApiClient } from "@wolbachia/api-client";
import { uploadPermitDocument } from "./permit-document-upload";

const UPLOAD = "00000000-0000-4000-8000-000000000354";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

afterEach(() => {
  vi.unstubAllGlobals();
});

function pdfFile(): File {
  return {
    size: PDF.length,
    type: "application/pdf",
    arrayBuffer: () => Promise.resolve(PDF.buffer),
  } as File;
}

test("a PDF is authorized, sent as application/pdf and verified", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const seen: { path: string; body: unknown; type: string | null }[] = [];
  const fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const isPut = request.method === "PUT";
    const body: unknown = isPut
      ? new Uint8Array(await request.arrayBuffer())
      : JSON.parse(await request.text());
    seen.push({ path, body, type: request.headers.get("Content-Type") });
    if (path.endsWith("/uploads/"))
      return Response.json(
        {
          upload_id: UPLOAD,
          url: `/api/v1/field/uploads/${UPLOAD}/content/`,
          method: "PUT",
          headers: { "Content-Type": "application/pdf", "Upload-Lease": "synthetic-lease" },
          expires_at: "2026-11-09T12:15:00Z",
        },
        { status: 201 },
      );
    if (isPut) return new Response(null, { status: 204 });
    return Response.json({ id: UPLOAD, state: "verified", verified_at: "2026-11-09T12:01:00Z" });
  };
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    auth: { kind: "session", getCsrfToken: () => "synthetic-csrf" },
    fetch,
  });
  const id = await uploadPermitDocument({
    client,
    file: pdfFile(),
    clientId: "00000000-0000-4000-8000-000000000001",
    signal: new AbortController().signal,
  });
  expect(id).toBe(UPLOAD);
  expect(seen[0]?.body).toMatchObject({ content_type: "application/pdf", size_bytes: PDF.length });
  expect(seen[1]?.type).toBe("application/pdf");
});

test("a file whose bytes are not a PDF is refused before any request", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const fake = {
    size: 4,
    type: "application/pdf",
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
  } as File;
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    auth: { kind: "session", getCsrfToken: () => "x" },
    fetch: () => Promise.reject(new Error("no request expected")),
  });
  await expect(
    uploadPermitDocument({
      client,
      file: fake,
      clientId: "c",
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("signature");
});
