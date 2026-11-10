import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";

interface PermitVersionRef {
  permitId: string;
  revision: number;
}

/** Authorized download of a permit version's official document (served as an attachment). */
export async function downloadPermitDocument(
  client: ApiClient,
  version: PermitVersionRef,
  signal?: AbortSignal,
): Promise<Blob> {
  const result = await client.GET("/api/v1/permits/{id}/versions/{revision}/document/", {
    params: { path: { id: version.permitId, revision: String(version.revision) } },
    parseAs: "blob",
    ...(signal ? { signal } : {}),
  });
  return unwrap(result);
}
