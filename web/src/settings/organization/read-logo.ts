import type { QueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../../session/session-events";
import type { ApiClient } from "@wolbachia/api-client";
import { unwrap } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { MAX_LOGO_BYTES } from "./branding";
interface Context {
  client: ApiClient;
  guard: SessionGuard;
  reader: FileReader;
}
/** Scoped endpoint only; data URLs contain the backend's validated PNG, never uploaded SVG. */
export async function readLogo({ client, guard, reader }: Context): Promise<void> {
  const blob = unwrap(
    await client.GET("/api/v1/organization/logo/", { signal: guard.signal, parseAs: "blob" }),
  );
  if (guard.isStale() || blob.type !== "image/png" || blob.size > MAX_LOGO_BYTES) return;
  reader.readAsDataURL(blob);
}

/** Optional media still participates in session expiry; unavailable raster keeps the initials fallback. */
export function reportLogoFailure({
  error,
  guard,
  queryClient,
}: {
  error: unknown;
  guard: SessionGuard;
  queryClient: QueryClient;
}): void {
  if (guard.isStale()) return;
  reportSessionError(error, queryClient);
  console.warn("Organization logo unavailable", error);
}
