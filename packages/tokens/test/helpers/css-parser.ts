/** Minimal parser for the flat custom-property blocks of the design CSS files. */

/** Custom property name without the leading `--` mapped to its raw value. */
export type CustomProperties = Record<string, string>;

const DECLARATION_PATTERN = /--([\w-]+)\s*:\s*([^;}]+)/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the custom properties declared in the first rule whose selector list
 * starts a line with `selectorStart` (for example `:root` or `.dark`).
 * @throws {Error} when no such rule exists.
 */
export function parseCustomProperties(css: string, selectorStart: string): CustomProperties {
  const rulePattern = new RegExp(`^${escapeRegExp(selectorStart)}[^{]*\\{([^}]*)\\}`, "m");
  const body = rulePattern.exec(css)?.[1];
  if (body === undefined) {
    throw new Error(`Rule starting with "${selectorStart}" not found`);
  }
  const properties: CustomProperties = {};
  for (const match of body.matchAll(DECLARATION_PATTERN)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) {
      properties[name] = value.trim();
    }
  }
  return properties;
}

/** Normalizes a CSS value so equivalent spellings compare equal (case, spaces, `0.1` vs `.1`). */
export function normalizeCssValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(^|[^\d])0\./g, "$1.")
    .replace(/(^|[^\d.])0px/g, "$10");
}
