/** The read-only token boundary shared by the API client and sync worker. */
export interface TokenStore {
  /** Issuing origin, retained through refresh and final upload. No settings fallback. */
  readonly getOrigin: () => string | null;
  /** Includes the retryable final-upload pair retained by an ended session. */
  readonly hasSyncSession: () => boolean;
  /** Ordinary requests can never read an ended session's access token. */
  readonly getAccessToken: () => string | undefined;
  readonly subscribe: (listener: () => void) => () => void;
}
