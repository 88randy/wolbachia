import { useEffect, useRef } from "react";

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
  /** Whether the result may still be acted on (also after the task settled). */
  isCurrent: () => boolean;
}

interface Queued {
  kind: AuthOperation;
  generation: number;
  isAbandoned: boolean;
  /** The task finished: abandoning it no longer means anything. */
  isSettled: boolean;
  controller: AbortController;
}

let generation = 0;
let tail: Promise<unknown> = Promise.resolve();

function isWanted(operation: Queued): boolean {
  if (operation.kind === "logout") return true;
  return !operation.isAbandoned && operation.generation === generation;
}

function createOperation(kind: AuthOperation): Queued {
  return {
    kind,
    generation,
    isAbandoned: false,
    isSettled: false,
    controller: new AbortController(),
  };
}

/**
 * Queues `task` behind every earlier auth operation.
 *
 * RULE: a task may only await signal-bound auth network calls (CSRF, login, logout and their
 * retries, all through `withAuthTimeout(signal)`), plus synchronous cache and identity updates.
 * Navigation, query invalidation or refetch, and anything else that can wait on something
 * unbounded happen AFTER the task: `result` resolves with the task's value and the caller acts on
 * it outside the queue (use `isCurrent()` first). One unbounded await here would block every
 * operation queued behind it, including a sign-out.
 */
export function runAuthOperation<T>(
  kind: AuthOperation,
  task: (context: AuthOperationContext) => Promise<T>,
): AuthOperationRun<T> {
  if (kind === "logout") generation += 1; // supersedes every login queued before it
  const operation = createOperation(kind);
  const result = tail
    .then(async () => {
      if (!isWanted(operation)) return undefined;
      return task({ signal: operation.controller.signal, isCurrent: () => isWanted(operation) });
    })
    .finally(() => {
      operation.isSettled = true;
    });
  tail = result.catch(() => undefined);
  return {
    result,
    isCurrent: () => isWanted(operation),
    abandon: () => {
      if (kind === "logout" || operation.isSettled) return;
      operation.isAbandoned = true;
      operation.controller.abort();
    },
  };
}

/** Forgets everything (tests only: module state must not leak between them). */
export function resetAuthOperation(): void {
  tail = Promise.resolve();
  generation = 0;
}

/**
 * Returns `track(run)`: call it with the login this component started; when the component
 * unmounts (the user left the screen) that login is abandoned.
 */
export function useAbandonOnUnmount(): (run: { abandon: () => void }) => void {
  const abandonRef = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      abandonRef.current?.();
    },
    [],
  );
  return (run) => {
    abandonRef.current = run.abandon;
  };
}
