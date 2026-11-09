import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../session/session-events";
import { currentRevision } from "../session/session-revision";
import { useInventoryContext } from "./use-inventory-context";
import { invalidateInventory, inventoryRouteScope } from "./inventory-query";
import type { InventoryKind } from "./inventory-links";
import { sendInventoryCommand } from "./inventory-write";
import type { InventoryCommand } from "./inventory-write";
import { inventoryFailure } from "./inventory-failure";
import type { InventoryFailure } from "./inventory-failure";
interface WriteContext {
  scope: ReturnType<typeof useInventoryContext>;
  begin: ReturnType<typeof useInventoryContext>["beginWrite"];
  cache: ReturnType<typeof useQueryClient>;
  busy: RefObject<boolean>;
  setBusy: (value: boolean) => void;
  receive: (failure: InventoryFailure | undefined, command?: InventoryCommand) => void;
}
function canStartWrite({ busy, scope }: WriteContext) {
  return (
    !busy.current &&
    scope.identity.isSettled &&
    scope.identity.revision === currentRevision() &&
    scope.readContext.mode === "admission" &&
    scope.isCurrentRead()
  );
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
    receive(failure, command);
    reportSessionError(error, cache);
    if (failure.conflict) await invalidateInventory(cache);
    return undefined;
  } finally {
    busy.current = false;
    if (!guard.isStale() && scope.isCurrentRead()) setBusy(false);
  }
}
/** Guard delivery and invalidation against session/context replacement, including ABA. */
export function useInventoryWrite(
  onFailure?: (failure: InventoryFailure, command: InventoryCommand) => void,
  owner?: { kind: InventoryKind; code?: string },
) {
  const current = useInventoryContext();
  const scope = owner ? inventoryRouteScope(current, owner.kind, owner.code) : current;
  const begin = scope.beginWrite;
  const cache = useQueryClient();
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<InventoryFailure>();
  const receive = (next: InventoryFailure | undefined, command?: InventoryCommand) => {
    if (scope.isCurrentRead()) setFailure(next);
    if (next && command) onFailure?.(next, command);
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
