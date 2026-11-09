import { createApiClient } from "@wolbachia/api-client";
import { expect, test } from "vitest";
import { uploadIncidentEvidence } from "./incident-evidence";
import type { IncidentUpload } from "./incident-evidence";
const ID = "00000000-0000-4000-8000-000000000034";
const CASE = "00000000-0000-4000-8000-000000000033";
function fileProof(): IncidentUpload {
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = new File([bytes], "proof.png", { type: "image/png" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(bytes.buffer.slice(0)),
  });
  return { file, clientId: "00000000-0000-4000-8000-000000000035" };
}
test("incident evidence uses original bytes, exact parent verification and same-ID renewal after an unknown finalize", async () => {
  const requests: { method: string; path: string; body: unknown }[] = [];
  let loseFinalize = true;
  const grant = {
    upload_id: ID,
    url: `/api/v1/field/uploads/${ID}/content/`,
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
      if (path.endsWith("/finalize/")) {
        if (loseFinalize) throw new TypeError("Lost finalize");
        return Response.json({ id: ID, state: "verified", verified_at: "2026-11-01T11:00:00Z" });
      }
      if (path.endsWith("/renew/"))
        return Response.json({
          ...grant,
          id: ID,
          state: "verified",
          verified_at: "2026-11-01T11:00:00Z",
        });
      return Response.json(grant, { status: 201 });
    },
  });
  let evidence = fileProof();
  const call = () => ({
    scope: { client },
    incident: CASE,
    evidence,
    signal: new AbortController().signal,
    requireCurrent: () => undefined,
    onAuthorized: (uploadId: string) => {
      evidence = { ...evidence, uploadId };
    },
  });
  await expect(uploadIncidentEvidence(call())).rejects.toThrow("Lost finalize");
  expect(requests.find((request) => request.path.endsWith("/finalize/"))?.body).toEqual({
    context: { kind: "incident", id: CASE },
  });
  expect(requests.find((request) => request.method === "PUT")?.body).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  loseFinalize = false;
  expect(await uploadIncidentEvidence(call())).toEqual({
    uploadId: ID,
    verifiedAt: "2026-11-01T11:00:00Z",
  });
  expect(requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  expect(requests.filter((request) => request.path === "/api/v1/field/uploads/")).toHaveLength(1);
});
