import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Auth operations (sign-in on the login page, re-authentication, sign-out) run strictly one after
 * another: a new one waits for the previous one to settle and is never rejected because another
 * is pending. Waiting is bounded because every network call of an operation has a timeout
 * (`withAuthTimeout`).
 *
 * - A login is superseded by any sign-out queued after it: its result is ignored (generation).
 * - A login may be abandoned (its screen went away): its request is aborted and, if it has not
 *   started, it never runs. A sign-out is never abandoned: it always completes, even after the
 *   screen that started it is gone.
 */
export type AuthOperation = "login" | "logout";

export interface AuthOperationContext {
  /** Aborted when a login is abandoned; pass it to every request of the operation. */
  signal: AbortSignal;
  /** False once the result must be ignored (abandoned, or a sign-out came after it). */
  isCurrent: () => boolean;
}

export interface AuthOperationRun<T> {
  /** The task's result; undefined when the operation was skipped without running. */
  result: Promise<T | undefined>;
  /** Abandons a login (no effect on a sign-out). */
  abandon: () => void;
}

interface Queued {
  kind: AuthOperation;
  generation: number;
  isAbandoned: boolean;
  controller: AbortController;
}

let generation = 0;
let tail: Promise<unknown> = Promise.resolve();
const active = new Set<Queued>();

function isWanted(operation: Queued): boolean {
  if (operation.kind === "logout") return true;
  return !operation.isAbandoned && operation.generation === generation;
}

/** Queues `task` behind every earlier auth operation. */
export function runAuthOperation<T>(
  kind: AuthOperation,
  task: (context: AuthOperationContext) => Promise<T>,
): AuthOperationRun<T> {
  if (kind === "logout") generation += 1;
  const operation: Queued = {
    kind,
    generation,
    isAbandoned: false,
    controller: new AbortController(),
  };
  active.add(operation);
  const result = tail.then(async () => {
    if (!isWanted(operation)) return undefined;
    return task({ signal: operation.controller.signal, isCurrent: () => isWanted(operation) });
  });
  const settled = result.finally(() => {
    active.delete(operation);
  });
  tail = settled.catch(() => undefined);
  return {
    result,
    abandon: () => {
      if (kind === "logout") return;
      operation.isAbandoned = true;
      operation.controller.abort();
    },
  };
}

/** Forgets everything (tests only: module state must not leak between them). */
export function resetAuthOperation(): void {
  active.forEach((operation) => {
    operation.controller.abort();
  });
  active.clear();
  tail = Promise.resolve();
  generation = 0;
}

/**
 * Keeps the `abandon` of the login this component started (assign `ref.current`); when the
 * component unmounts (the user left the screen) that login is abandoned.
 */
export function useAbandonOnUnmount(): RefObject<(() => void) | undefined> {
  const abandonRef = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      abandonRef.current?.();
    },
    [],
  );
  return abandonRef;
}
