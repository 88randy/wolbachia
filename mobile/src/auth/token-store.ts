/** The read-only token boundary shared by the API client and sync worker. */
export interface TokenStore {
  getAccessToken(): string | undefined;
  subscribe(listener: () => void): () => void;
}
