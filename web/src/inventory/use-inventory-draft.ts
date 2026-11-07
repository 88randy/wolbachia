import { createContext, useContext, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { InventoryValues } from "./inventory-fields";
import type { InventoryRecord } from "./inventory-links";
import type { InventoryFailure } from "./inventory-failure";
import type { InventoryFormCommand } from "./inventory-write";
export interface RetainedAttempt {
  readonly command: InventoryFormCommand;
  readonly base: string;
  readonly context: string;
}
export interface RetainedDraft {
  values: InventoryValues;
  reviewed?: InventoryRecord;
  failure?: InventoryFailure;
  attempt?: RetainedAttempt;
}
export const InventoryDraftMemory = createContext<{ current: Record<string, RetainedDraft> }>({
  current: {},
});
/** Draft memory belongs to a user/org boundary, never storage or the URL. */
export function useInventoryDraft(key: string, initial: RetainedDraft) {
  const memory = useContext(InventoryDraftMemory);
  const [draft, update] = useState(() => memory.current[key] ?? initial);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const setDraft = (next: SetStateAction<RetainedDraft>) => {
    const value = typeof next === "function" ? next(draftRef.current) : next;
    draftRef.current = value;
    memory.current[key] = value;
    update(value);
  };
  return {
    draft,
    setDraft,
    clear: () => {
      memory.current = Object.fromEntries(
        Object.entries(memory.current).filter(([candidate]) => candidate !== key),
      );
    },
  };
}
