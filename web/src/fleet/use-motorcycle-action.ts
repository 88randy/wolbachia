import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionGuard } from "../session/use-session-guard";
import { useMe } from "../session/use-me";
import { submitVoid } from "../void";
import type { VoidResult } from "../void";
import { invalidateFleet } from "./fleet-query";
export type MotorcycleAction = "void" | "unblock";
/** One explicit attempt. The revision guard precedes session reports and invalidation;
 * no effect, mutation retry or re-authentication callback can replay the write. */
export function useMotorcycleAction(id: string, action: MotorcycleAction) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const me = useMe();
  const begin = useSessionGuard();
  return async (reason: string): Promise<VoidResult> => {
    const { signal, isStale } = begin();
    const path =
      action === "void" ? "/api/v1/motorcycles/{id}/void/" : "/api/v1/motorcycles/{id}/unblock/";
    const result = await submitVoid(
      queryClient,
      () =>
        client.POST(path, {
          params: { path: { id } },
          body: { reason },
          signal,
        }),
      isStale,
    );
    if (!isStale() && shouldRefresh(result)) void invalidateFleet(queryClient, me);
    return isStale() ? { ok: false, isStale: true } : result;
  };
}
function shouldRefresh(result: VoidResult): boolean {
  if (result.ok) return true;
  if ("isStale" in result) return false;
  return result.failure.kind === "blocked" || result.failure.kind === "alreadyVoided";
}
