import { isErrorEnvelope, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { BundleTransport } from "./bundle-service.ts";
import { SYNC_REQUEST_TIMEOUT_MS } from "../../sync/sync-transport.ts";
/** Boundary validates the object later in DayStore; generated bootstrap response incorrectly says array. */
export function createBootstrapTransport(client: ApiClient): BundleTransport {
  return async (etag) => {
    const result = await client.GET("/api/v1/field/bootstrap/", {
      headers: etag === null ? {} : { "If-None-Match": `"${etag}"` },
      signal: AbortSignal.timeout(SYNC_REQUEST_TIMEOUT_MS),
    });
    if (result.response.status === 304) return { kind: "unchanged" };
    const code = isErrorEnvelope(result.error) ? result.error.code : null;
    if (
      result.response.status === 403 ||
      (result.response.status === 401 && code === "session_revoked")
    )
      return { kind: "revoked" };
    const body: unknown = unwrap(result);
    return { kind: "bundle", body };
  };
}
