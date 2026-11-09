/** Session-only drafts: never store API results, identities of other people, or credentials. */
export function readLabStored(key: string): string | null {
  try { return window.sessionStorage.getItem(key); }
  catch (error) { console.warn("Could not read laboratory draft", error); return null; }
}
export function writeLabStored(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch (error) { console.warn("Could not retain laboratory draft", error); }
}
/** Reuse the UUID for an identical payload; mounted editors retain the full command for retry. */
export function commandId(key: string, signature: string): string {
  const stored = readLabStored(key);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null && "signature" in parsed && parsed.signature === signature && "id" in parsed && typeof parsed.id === "string") return parsed.id;
    } catch (error) { console.warn("Invalid laboratory command draft", error); }
  }
  const id = crypto.randomUUID();
  writeLabStored(key, JSON.stringify({ signature, id }));
  return id;
}
