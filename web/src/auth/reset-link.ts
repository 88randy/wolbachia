/** The two values of the emailed reset link. */
export interface ResetLink {
  uid: string;
  token: string;
}

// Conservative shape: `uid` is URL-safe base64 of the user id and `token` is Django's
// `<base36 timestamp>-<hash>`; both fit in letters, digits, `-` and `_`. Anything else is not
// one of our links, so it is never sent to the server.
const SAFE_VALUE = /^[A-Za-z0-9_-]{1,128}$/;

function singleValue(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name);
  const [value] = values;
  return values.length === 1 && value !== undefined && SAFE_VALUE.test(value) ? value : undefined;
}

/**
 * Reads `uid` and `token` from the fragment of the emailed link (`#uid=...&token=...`, with or
 * without the leading `#`). A missing, repeated or oddly shaped value gives `undefined`, which
 * the page shows as an invalid link. Nothing here logs or returns the raw fragment.
 */
export function parseResetFragment(hash: string): ResetLink | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const uid = singleValue(params, "uid");
  const token = singleValue(params, "token");
  return uid !== undefined && token !== undefined ? { uid, token } : undefined;
}
