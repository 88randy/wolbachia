/** Longest an auth request (CSRF, login, logout) may take before it is aborted. */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/** Aborts when either signal does. `AbortSignal.any` is not in every browser we build for. */
function anyOf(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) controller.abort();
    else
      signal.addEventListener("abort", () => {
        controller.abort();
      });
  }
  return controller.signal;
}

/**
 * The signal of one auth request: the operation's own (abandonment) plus a timeout, so waiting
 * for a request, and therefore the queue of auth operations, is always bounded.
 */
export function withAuthTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS);
  return signal ? anyOf([signal, timeout]) : timeout;
}
