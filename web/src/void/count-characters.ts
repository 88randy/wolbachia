/**
 * How a void reason is read, mirroring `backend/core/void_reason.py` (the server decides; this
 * only saves a round trip). Text that shows nothing never reaches the minimum.
 */

/** Any whitespace (a line feed is allowed but shows nothing), zero-width and joiner (Cf), combining marks (Mn, Me), every space and separator (Z*), the
 * Hangul fillers and the braille blank. */
const INVISIBLE =
  /[\s\p{Cf}\p{Mn}\p{Me}\p{Zs}\p{Zl}\p{Zp}\p{Co}\p{Cn}\u115F\u1160\u3164\uFFA0\u2800]/gu;
/** Control characters except a line feed, lone surrogates and the bidirectional controls. */
const FORBIDDEN = /[\p{Cc}\p{Cs}\u202A-\u202E\u2066-\u2069]/u;

/** The text the server stores: CRLF as LF, NFC, trimmed. `trim()` also removes U+FEFF. */
export function normalizeReason(text: string): string {
  return text.replace(/\r\n/g, "\n").normalize("NFC").trim();
}

/** Control or bidi characters the server refuses (`void_reason_invalid_characters`). */
export function hasForbiddenCharacters(normalized: string): boolean {
  return FORBIDDEN.test(normalized.replace(/\n/g, ""));
}

/** Characters that show something, counted as code points like Python's `len`. */
export function countCharacters(normalized: string): number {
  return Array.from(normalized.replace(INVISIBLE, "")).length;
}
