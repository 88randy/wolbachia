import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { reportSessionError } from "../../session/session-events";
import { inventoryFailure } from "../inventory-failure";
import type { InventoryFailure } from "../inventory-failure";
import { useInventoryContext } from "../use-inventory-context";
import { sendDiscrepancyClose } from "./discrepancy-command";
import type { DiscrepancyCommand } from "./discrepancy-command";
import type { SessionGuard } from "../../session/use-session-guard";
import { transferRouteScope } from "./transfer-route-scope";

interface CommandStatus {
  phase: "busy" | "saved" | "failed";
  revision: number;
  failure?: InventoryFailure;
  receipt?: Schemas["TransferEvent"];
}
type Runtime = ReturnType<typeof useCommandRuntime>;
function isAttemptCurrent(scope: Runtime["scope"], guard: SessionGuard) {
  return !guard.isStale() && scope.isCurrentRead();
}
function useCommandRuntime(code: string) {
  const scope = transferRouteScope(useInventoryContext(), "discrepancies", code);
  const cache = useQueryClient();
  const lock = useRef<symbol | null>(null);
  const frozen = useRef<DiscrepancyCommand | null>(null);
  const [status, setStatus] = useState<CommandStatus | null>(null);
  useEffect(() => {
    lock.current = null;
  }, [scope.identity.revision]);
  return { scope, cache, lock, frozen, status, setStatus };
}
async function performClose(runtime: Runtime, command: DiscrepancyCommand) {
  const { scope } = runtime;
  const guard = scope.beginWrite();
  if (!isAttemptCurrent(scope, guard)) return;
  const exact = (runtime.frozen.current ??= structuredClone(command));
  const token = Symbol();
  runtime.lock.current = token;
  runtime.setStatus({ phase: "busy", revision: scope.identity.revision });
  try {
    const receipt = await sendDiscrepancyClose(scope.client, exact, guard.signal);
    if (!isAttemptCurrent(scope, guard)) return;
    runtime.setStatus({ phase: "saved", revision: scope.identity.revision, receipt });
    await invalidateOrgScoped(runtime.cache, "transfers");
    if (!isAttemptCurrent(scope, guard)) return;
    await invalidateOrgScoped(runtime.cache, "inventory");
  } catch (error) {
    if (!isAttemptCurrent(scope, guard)) return;
    runtime.setStatus({
      phase: "failed",
      revision: scope.identity.revision,
      failure: inventoryFailure(error),
    });
    reportSessionError(error, runtime.cache);
  } finally {
    if (runtime.lock.current === token) runtime.lock.current = null;
  }
}
/** Freeze one exact command across explicit retries; scope/session changes never replay it. */
export function useDiscrepancyCommand(code: string) {
  const runtime = useCommandRuntime(code);
  const canSend = () =>
    !runtime.lock.current &&
    runtime.scope.identity.isSettled &&
    runtime.scope.isCurrentRead() &&
    runtime.scope.identity.permissions?.includes("discrepancy.close");
  return {
    status: runtime.status,
    isBusy:
      runtime.status?.phase === "busy" &&
      runtime.status.revision === runtime.scope.identity.revision,
    isFrozen: runtime.frozen.current !== null,
    send: (command: DiscrepancyCommand) => {
      if (!canSend() || runtime.frozen.current) return Promise.resolve();
      return performClose(runtime, command);
    },
    retry: () =>
      canSend() && runtime.frozen.current
        ? performClose(runtime, runtime.frozen.current)
        : Promise.resolve(),
    reset: () => {
      runtime.frozen.current = null;
      runtime.setStatus(null);
    },
  };
}
