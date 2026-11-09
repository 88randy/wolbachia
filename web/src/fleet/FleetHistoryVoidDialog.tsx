import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useVoidLimits, VoidDialog, submitVoid } from "../void";
import type { VoidChoice } from "../void";
import { useSessionGuard } from "../session/use-session-guard";
import type { Schemas } from "@wolbachia/api-client";
import type { FleetRecordScope } from "./use-fleet-scope";
import { invalidateFleet } from "./fleet-query";
interface Props {
  row: Schemas["ServiceRecord"] | Schemas["ResponsibilityLetter"];
  scope: FleetRecordScope;
  onClose: () => void;
}
interface Context extends Props {
  cache: QueryClient;
  begin: ReturnType<typeof useSessionGuard>;
}
function requestVoid(context: Context, choice: VoidChoice, signal: AbortSignal) {
  const { row, scope } = context;
  const options = {
    params: { path: { motorcycle_id: row.motorcycle, id: row.id } },
    body: { reason_code: choice.reasonCode, reason: choice.reason },
    signal,
  };
  return "kind" in row
    ? scope.client.POST("/api/v1/motorcycles/{motorcycle_id}/services/{id}/void/", options)
    : scope.client.POST(
        "/api/v1/motorcycles/{motorcycle_id}/responsibility-letters/{id}/void/",
        options,
      );
}
async function voidHistory(context: Context, choice: VoidChoice) {
  const guard = context.begin();
  const isStale = () => guard.isStale() || !context.scope.isCurrent();
  if (isStale()) return { ok: false, isStale: true } as const;
  const result = await submitVoid(
    context.cache,
    () => requestVoid(context, choice, guard.signal),
    isStale,
  );
  const refreshed =
    result.ok ||
    ("failure" in result && ["blocked", "alreadyVoided"].includes(result.failure.kind));
  if (!isStale() && refreshed) await invalidateFleet(context.cache);
  return result;
}
export function FleetHistoryVoidDialog(props: Props) {
  const limits = useVoidLimits();
  const cache = useQueryClient();
  const begin = useSessionGuard();
  return (
    <VoidDialog
      record={props.row.id}
      limits={limits}
      submit={(choice) => voidHistory({ ...props, cache, begin }, choice)}
      onVoided={props.onClose}
      onCancel={props.onClose}
    />
  );
}
