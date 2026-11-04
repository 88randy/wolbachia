/** The two values of the emailed reset link. */
export interface ResetLink {
  uid: string;
  token: string;
}

/** Where the address bar is left once a link has been read: no token, no fragment. */
export const RESET_ADDRESS = "/reset-password";

// Conservative shape: `uid` is URL-safe base64 of the user id and `token` is Django's
// `<base36 timestamp>-<hash>`; both fit in letters, digits, `-` and `_`. Anything else is not
// one of our links, so it is never sent to the server.
const SAFE_VALUE = /^[A-Za-z0-9_-]{1,128}$/;

/** The link for these values, or `undefined` when either is not shaped like ours. */
export function toResetLink(uid: string, token: string): ResetLink | undefined {
  return SAFE_VALUE.test(uid) && SAFE_VALUE.test(token) ? { uid, token } : undefined;
}

function singleValue(params: URLSearchParams, name: string): string {
  const values = params.getAll(name);
  return values.length === 1 ? (values[0] ?? "") : "";
}

/**
 * Reads `uid` and `token` from the fragment of the emailed link (`#uid=...&token=...`, with or
 * without the leading `#`). A missing, repeated or oddly shaped value gives `undefined`, which
 * the page shows as an invalid link. Nothing here logs or returns the raw fragment.
 */
export function parseResetFragment(hash: string): ResetLink | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return toResetLink(singleValue(params, "uid"), singleValue(params, "token"));
}
