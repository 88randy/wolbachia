import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { useInventoryContext } from "./use-inventory-context";
import { inventoryRecordOptions, invalidateInventory } from "./inventory-query";
import { matchesInventoryAttempt } from "./inventory-reconciliation";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import type { RetainedDraft, RetainedAttempt } from "./use-inventory-draft";
function checkableAttempt(
  attempt: RetainedAttempt | undefined,
  scope: ReturnType<typeof useInventoryContext>,
): attempt is RetainedAttempt {
  return attempt !== undefined && scope.identity.isSettled && attempt.base === scope.base;
}
export function useInventoryReconciliation(
  kind: InventoryKind,
  onConfirmed: (record: InventoryRecord) => void,
) {
  const scope = useInventoryContext();
  const cache = useQueryClient();
  const begin = useSessionGuard();
  const busy = useRef(false);
  const [isChecking, setChecking] = useState(false);
  const reconcile = async (draft: RetainedDraft) => {
    const attempt = draft.attempt;
    if (busy.current || !checkableAttempt(attempt, scope)) return;
    busy.current = true;
    setChecking(true);
    const guard = begin();
    try {
      const current = await readDraft(scope, cache, { kind, attempt });
      if (guard.isStale() || !matchesInventoryAttempt(attempt, current, scope.base)) return;
      await invalidateInventory(cache);
      if (!guard.isStale()) onConfirmed(current);
    } catch (error) {
      if (!guard.isStale()) reportSessionError(error, cache);
    } finally {
      busy.current = false;
      if (!guard.isStale()) setChecking(false);
    }
  };
  return { reconcile, isChecking };
}
function readDraft(
  scope: ReturnType<typeof useInventoryContext>,
  cache: ReturnType<typeof useQueryClient>,
  target: { kind: InventoryKind; attempt: RetainedAttempt },
) {
  return cache.query({
    ...inventoryRecordOptions(scope, target.kind, target.attempt.command.body.code),
    staleTime: 0,
    retry: false,
  });
}
