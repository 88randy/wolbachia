import { useSyncExternalStore } from "react";

/**
 * Sign-in again and sign-out must not overlap: a late login answer would fill `/me/` after the
 * user signed out, and could even install a new session cookie. Only one runs at a time, and an
 * answer that arrives for an older operation is dropped.
 */
export type AuthOperation = "login" | "logout";

type Listener = () => void;

let generation = 0;
let pending: AuthOperation | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

/** Starts an operation; returns its generation, or undefined when another one is running. */
export function startAuthOperation(kind: AuthOperation): number | undefined {
  if (pending !== null) return undefined;
  pending = kind;
  generation += 1;
  notify();
  return generation;
}

/** Whether `token` is still the latest operation (its answer may be applied). */
export function isCurrentOperation(token: number): boolean {
  return token === generation;
}

export function finishAuthOperation(token: number): void {
  if (token !== generation || pending === null) return;
  pending = null;
  notify();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The operation in flight, if any (to disable the other action). */
export function usePendingAuthOperation(): AuthOperation | null {
  return useSyncExternalStore(subscribe, () => pending);
}
