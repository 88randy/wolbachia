import { createContext, useContext, useRef, useSyncExternalStore } from "react";
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
export function inventoryDraftMemory() {
  const listeners = new Set<() => void>();
  return {
    current: {} as Record<string, RetainedDraft>,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: () => {
      for (const listener of listeners) listener();
    },
  };
}
export const InventoryDraftMemory = createContext(inventoryDraftMemory());
/** Draft memory belongs to a user/org boundary, never storage or the URL. */
export function useInventoryDraft(key: string, initial: RetainedDraft) {
  const memory = useContext(InventoryDraftMemory);
  const initialDraft = useRef(initial);
  const read = () => memory.current[key] ?? initialDraft.current;
  const draft = useSyncExternalStore(memory.subscribe, read, read);
  const setDraft = (next: SetStateAction<RetainedDraft>) => {
    const value = typeof next === "function" ? next(read()) : next;
    memory.current[key] = value;
    memory.notify();
  };
  return {
    draft,
    setDraft,
    read,
    updateAttempt: (attempt: RetainedAttempt, next: (draft: RetainedDraft) => RetainedDraft) => {
      if (memory.current[key]?.attempt !== attempt) return false;
      setDraft(next);
      return true;
    },
  };
}
