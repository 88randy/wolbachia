import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { currentRevision } from "../session/session-revision";
import { useInventoryContext } from "./use-inventory-context";
import { invalidateInventory } from "./inventory-query";
import { sendInventoryCommand } from "./inventory-write";
import type { InventoryCommand } from "./inventory-write";
import { inventoryFailure } from "./inventory-failure";
import type { InventoryFailure } from "./inventory-failure";
interface WriteContext {
  scope: ReturnType<typeof useInventoryContext>;
  begin: ReturnType<typeof useSessionGuard>;
  cache: ReturnType<typeof useQueryClient>;
  busy: RefObject<boolean>;
  setBusy: (value: boolean) => void;
  receive: (failure: InventoryFailure | undefined) => void;
}
function canStartWrite({ busy, scope }: WriteContext) {
  return !busy.current && scope.identity.isSettled && scope.identity.revision === currentRevision();
}
async function runWrite(context: WriteContext, command: InventoryCommand) {
  const { scope, begin, cache, busy, setBusy, receive } = context;
  if (!canStartWrite(context)) return undefined;
  const guard = begin();
  if (guard.isStale()) return undefined;
  busy.current = true;
  setBusy(true);
  receive(undefined);
  try {
    const record = await sendInventoryCommand(scope.client, command, guard.signal);
    if (guard.isStale()) return undefined;
    await invalidateInventory(cache);
    return guard.isStale() ? undefined : record;
  } catch (error) {
    if (guard.isStale()) return undefined;
    const failure = inventoryFailure(error);
    receive(failure);
    reportSessionError(error, cache);
    if (failure.conflict) await invalidateInventory(cache);
    return undefined;
  } finally {
    busy.current = false;
    if (!guard.isStale()) setBusy(false);
  }
}
/** Guard delivery and invalidation against session/context replacement, including ABA. */
export function useInventoryWrite(onFailure?: (failure: InventoryFailure) => void) {
  const scope = useInventoryContext();
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<InventoryFailure>();
  const receive = (next: InventoryFailure | undefined) => {
    setFailure(next);
    if (next) onFailure?.(next);
  };
  const context = { scope, begin, cache, busy, setBusy, receive };
  return {
    send: (command: InventoryCommand) => runWrite(context, command),
    isBusy,
    failure,
    clearFailure: () => {
      setFailure(undefined);
    },
  };
}
