import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "../storage/safe-storage";

/** Tutorials a user has finished, kept in localStorage per user. A convenience, never the source of truth. */
const KEY_PREFIX = "wolbachia.tutorials.done.";
const CHANGE_EVENT = "wolbachia:tutorials-progress";
const EMPTY: readonly string[] = [];

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** The finished tutorial ids of one user; a corrupt or missing value reads as none. */
export function readFinished(userId: string): readonly string[] {
  const raw = readStored(storageKey(userId));
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function markFinished(userId: string, tutorialId: string): void {
  const finished = readFinished(userId);
  if (finished.includes(tutorialId)) return;
  writeStored(storageKey(userId), JSON.stringify([...finished, tutorialId]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Whether a user finished a tutorial; updates when the modal marks it or another tab does. */
export function useIsFinished(userId: string, tutorialId: string): boolean {
  return useSyncExternalStore(subscribe, () => readFinished(userId).includes(tutorialId));
}
