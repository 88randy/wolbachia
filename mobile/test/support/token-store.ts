import type { TokenStore } from "../../src/auth/token-store.ts";

export function createMemoryTokenStore(): TokenStore & {
  setAccessToken(token: string | undefined): void;
} {
  let accessToken: string | undefined;
  const listeners = new Set<() => void>();
  return {
    hasSyncSession: () => accessToken !== undefined,
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
