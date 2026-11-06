import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionGuard } from "../session/use-session-guard";
import { submitVoid } from "../void";
import type { VoidChoice, VoidResult } from "../void";
import { invalidateFleet } from "./fleet-query";
import { withUnblockFailure } from "./unblock-failure";
export type MotorcycleAction = "void" | "unblock";
/** One explicit attempt. The revision guard precedes session reports and invalidation;
 * no effect, mutation retry or re-authentication callback can replay the write. */
export function useMotorcycleAction(id: string, action: MotorcycleAction) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  return async ({ reasonCode, reason }: VoidChoice): Promise<VoidResult> => {
    const { signal, isStale } = begin();
    // A void carries the catalog code (#80); unblocking has no catalog, only the written reason.
    const send = () =>
      action === "void"
        ? client.POST("/api/v1/motorcycles/{id}/void/", {
            params: { path: { id } },
            body: { reason_code: reasonCode, reason },
            signal,
          })
        : client.POST("/api/v1/motorcycles/{id}/unblock/", {
            params: { path: { id } },
            body: { reason },
            signal,
          });
    const { result, error } = await submitMotorcycleAction(queryClient, send, isStale);
    if (!isStale() && shouldRefresh(result)) void invalidateFleet(queryClient);
    if (isStale()) return { ok: false, isStale: true };
    return action === "unblock" ? withUnblockFailure(result, error) : result;
  };
}

async function submitMotorcycleAction(
  queryClient: QueryClient,
  send: Parameters<typeof submitVoid>[1],
  isStale: () => boolean,
) {
  let error: unknown;
  const result = await submitVoid(
    queryClient,
    async () => {
      const answer = await send();
      error = answer.error;
      return answer;
    },
    isStale,
  );
  return { result, error };
}
function shouldRefresh(result: VoidResult): boolean {
  if (result.ok) return true;
  if ("isStale" in result) return false;
  return result.failure.kind === "blocked" || result.failure.kind === "alreadyVoided";
}
