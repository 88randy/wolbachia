import { useMemo } from "react";
import type { ReactNode } from "react";
import { InventoryDraftMemory } from "./use-inventory-draft";
import { useInventoryContext } from "./use-inventory-context";
import type { RetainedDraft } from "./use-inventory-draft";
/** Context transitions remount data observers while user/org memory survives reauthentication. */
export function InventoryScreen({ children }: { children: ReactNode }) {
  const { base } = useInventoryContext();
  const memory = useMemo<{ base: string; current: Record<string, RetainedDraft> }>(
    () => ({ base, current: {} }),
    [base],
  );
  return <InventoryDraftMemory value={memory}>{children}</InventoryDraftMemory>;
}
