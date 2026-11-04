import { messages } from "@wolbachia/i18n";
import type { MessageKey } from "@wolbachia/i18n";

const KNOWN_KEYS = new Set<string>(Object.keys(messages["es-MX"]));

/** Narrows the message of a form error (a catalog key written by a schema) to a `MessageKey`. */
export function isMessageKey(value: string | undefined): value is MessageKey {
  return value !== undefined && KNOWN_KEYS.has(value);
}
