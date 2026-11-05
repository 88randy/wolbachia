import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionGuard } from "../session/use-session-guard";
import { createMotorcycle } from "./create-motorcycle";
import type { CreateOutcome } from "./create-motorcycle";
import { invalidateFleet } from "./fleet-query";
import type { MotorcycleValues } from "./motorcycle-schema";
/** The same revision guards the response and the refresh that follows it. */
export function useSendMotorcycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  return async (values: MotorcycleValues): Promise<CreateOutcome> => {
    const guard = begin();
    const outcome = await createMotorcycle({ client, queryClient, guard, values });
    if (!guard.isStale() && outcome.kind === "saved") await invalidateFleet(queryClient);
    return guard.isStale() ? { kind: "stale" } : outcome;
  };
}
