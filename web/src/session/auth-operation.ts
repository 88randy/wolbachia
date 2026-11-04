import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";

/**
 * Sign-in (login page or re-authentication) and sign-out never overlap: a late login answer
 * would fill `/me/` after the user signed out, and could even install a new session cookie.
 * Only one operation runs at a time. The lock is released when its HTTP request settles or is
 * aborted, never earlier. An operation that is abandoned (its screen went away) is aborted and
 * its late result is ignored.
 */
export type AuthOperation = "login" | "logout";

export interface AuthOperationHandle {
  token: number;
  /** Aborted when the operation is abandoned: pass it to the request. */
  signal: AbortSignal;
}

interface Running {
  kind: AuthOperation;
  token: number;
  controller: AbortController;
  isAbandoned: boolean;
}

type Listener = () => void;

let generation = 0;
let running: Running | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

/** Starts an operation; undefined when another one is still running. */
export function startAuthOperation(kind: AuthOperation): AuthOperationHandle | undefined {
  if (running !== null) return undefined;
  generation += 1;
  const controller = new AbortController();
  running = { kind, token: generation, controller, isAbandoned: false };
  notify();
  return { token: generation, signal: controller.signal };
}

/** Whether `token` is the running operation and still wanted (its result may be applied). */
export function isCurrentOperation(token: number): boolean {
  return running?.token === token && !running.isAbandoned;
}

/** The screen that started `token` went away: abort its request and ignore its result. */
export function abandonAuthOperation(token: number): void {
  if (running?.token !== token) return;
  running.isAbandoned = true;
  running.controller.abort();
}

/** Releases the lock. Call it when the request has settled (success, failure or abort). */
export function finishAuthOperation(token: number): void {
  if (running?.token !== token) return;
  running = null;
  notify();
}

/** Forgets everything (tests only: module state must not leak between them). */
export function resetAuthOperation(): void {
  running?.controller.abort();
  running = null;
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
  return useSyncExternalStore(subscribe, () => running?.kind ?? null);
}

/**
 * Keeps the token of the sign-in this component started (assign `ref.current`); when the component
 * unmounts (the user left the screen) that operation is abandoned.
 */
export function useAbandonOnUnmount(): RefObject<number | undefined> {
  const tokenRef = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (tokenRef.current !== undefined) abandonAuthOperation(tokenRef.current);
    },
    [],
  );
  return tokenRef;
}
