/**
 * Where the session's access token lives while the app runs.
 *
 * PLACEHOLDER (issue #6). Login, token refresh and secure storage (Android Keystore) arrive with
 * #7; until then the token is only ever in memory and nothing writes it to disk. The interface is
 * what the API client and the sync engine depend on, so #7 swaps the implementation, not the callers.
 */
export interface TokenStore {
  /** The current access token, or `undefined` when nobody is signed in. */
  getAccessToken(): string | undefined;
  /** Replaces the token (`undefined` signs out). */
  setAccessToken(token: string | undefined): void;
  /** Calls `listener` after every change; returns the function that stops listening. */
  subscribe(listener: () => void): () => void;
}

export function createMemoryTokenStore(): TokenStore {
  let accessToken: string | undefined;
  const listeners = new Set<() => void>();
  return {
    getAccessToken: () => accessToken,
    setAccessToken(token) {
      accessToken = token;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
