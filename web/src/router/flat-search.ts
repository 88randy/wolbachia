/**
 * Query-string format of the whole router: flat `key=value` pairs, every value a string.
 *
 * TanStack Router's default parses values as JSON (`?code=1e3` becomes the number 1000) and
 * quotes strings that look like JSON when it writes them back (`?code=%221e3%22`). A filter such as
 * `?code=4471` or `?q=1.0` must keep exactly what the user typed, and the URLs must stay
 * readable (`?status=open&ordering=-created_at&page=2`, issue #29). ADR 0001 says to keep search
 * parameters flat; this makes the router do the same.
 */

/** Parses `?a=1&b=x` (the leading `?` is optional). A repeated key keeps its last value. */
export function parseFlatSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr));
}

/** Writes search values as `?a=1&b=x`. `undefined`, `null` and objects are left out. */
export function stringifyFlatSearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") params.set(key, value);
    else if (typeof value === "number" || typeof value === "boolean")
      params.set(key, String(value));
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}
