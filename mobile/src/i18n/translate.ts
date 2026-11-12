import { messages } from "@wolbachia/i18n";
import type { Locale, MessageKey } from "@wolbachia/i18n";

export type TranslateParams = Readonly<Record<string, string | number>>;

export type Translate = (key: MessageKey, params?: TranslateParams) => string;

/** True when `key` is a key of the shared catalogs (keys built from server codes may not be). */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(messages["es-MX"], key);
}

/**
 * Looks a message up and fills its `{name}` placeholders. A placeholder without a value is left as
 * written, so a missing parameter is visible in testing instead of silently empty.
 */
export function translate(locale: Locale, key: MessageKey, params: TranslateParams = {}): string {
  // A count of exactly one uses the singular message <key>One when the catalog has it.
  const singular = key + "One";
  const template =
    params.count === 1 && Object.hasOwn(messages[locale], singular)
      ? messages[locale][singular as MessageKey]
      : messages[locale][key];
  return template.replace(/\{([A-Za-z0-9]+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function createTranslate(locale: Locale): Translate {
  return (key, params) => translate(locale, key, params);
}
