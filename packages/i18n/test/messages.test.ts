import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultLocale, messages } from "../src/index.ts";
import type { Locale } from "../src/index.ts";

const KEY_CONVENTION = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const STRAY_BRACE = /[{}]/;

const locales = Object.keys(messages) as Locale[];

/**
 * Messages that take a placeholder, sorted by key. A new one is added here on purpose: the
 * wording around a number or a noun must not need plural or gender agreement (see the README).
 * `table.*` fill in the range, the count, a translated column header or filter name, and a row
 * name the screen provides; each sentence reads the same for 1 and for many.
 * `rules.*` fill in a formatted date, a formatted bound of the allowed range and a short user
 * reference; none needs plural or gender agreement.
 * `voiding.*` fill in a count, the configured length limits, a record code and the reason or
 * author of a void; the minimum is 10 by default, so no sentence has a singular form.
 */
const ALLOWED_PLACEHOLDERS: readonly (readonly [string, readonly string[]])[] = [
  ["auth.lockout.message", ["minutes"]],
  ["errors.api.blocked", ["role"]],
  ["rules.compare.from", ["date"]],
  ["rules.error.atLeast", ["min"]],
  ["rules.error.atMost", ["max"]],
  ["rules.error.range", ["max", "min"]],
  ["rules.form.scheduledNote", ["date"]],
  ["rules.history.hiddenNote", ["count"]],
  ["rules.history.userRef", ["id"]],
  ["rules.history.voidLabel", ["date"]],
  ["rules.range.atLeast", ["min"]],
  ["rules.range.atMost", ["max"]],
  ["rules.range.between", ["max", "min"]],
  ["table.filters.ignoredBody", ["names"]],
  ["table.filters.ignoredMore", ["count"]],
  ["table.filters.remove", ["filter", "value"]],
  ["table.pager.position", ["page", "pages"]],
  ["table.selection.count", ["count"]],
  ["table.selection.row", ["row"]],
  ["table.sort.ascending", ["column"]],
  ["table.sort.descending", ["column"]],
  ["table.status.range", ["from", "to", "total"]],
  ["table.status.rangeCursor", ["count"]],
  ["table.voided.author", ["author"]],
  ["table.voided.reason", ["reason"]],
  ["table.voided.when", ["when"]],
  ["voiding.dialog.counterBelow", ["count", "min"]],
  ["voiding.dialog.counterOk", ["count", "max"]],
  ["voiding.dialog.minHelp", ["min"]],
  ["voiding.dialog.title", ["record"]],
  ["voiding.error.tooShort", ["min"]],
];

function sortedKeys(locale: Locale): string[] {
  return Object.keys(messages[locale]).sort();
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "").sort();
}

void describe("catalogs", () => {
  void test("es-MX is the default locale", () => {
    assert.equal(defaultLocale, "es-MX");
  });

  void test("es-MX and en have the same keys", () => {
    const spanishKeys = sortedKeys("es-MX");

    const englishKeys = sortedKeys("en");

    assert.deepEqual(englishKeys, spanishKeys);
  });

  void test("es-MX and en use the same placeholders in every message", () => {
    const englishByKey = new Map(Object.entries(messages.en));
    const mismatches = Object.entries(messages["es-MX"]).flatMap(([key, spanish]) => {
      const english = englishByKey.get(key) ?? "";
      const expected = placeholdersOf(spanish);
      const actual = placeholdersOf(english);
      return expected.join() === actual.join()
        ? []
        : [`${key}: es-MX {${expected.join(",")}} vs en {${actual.join(",")}}`];
    });

    assert.deepEqual(mismatches, []);
  });
  void test("only the listed keys take a placeholder, each with exactly the listed ones", () => {
    const withPlaceholders = Object.entries(messages["es-MX"])
      .filter(([, text]) => placeholdersOf(text).length > 0)
      .map(([key, text]) => [key, placeholdersOf(text)] as const)
      .sort(([first], [second]) => first.localeCompare(second));

    assert.deepEqual(withPlaceholders, ALLOWED_PLACEHOLDERS);
  });

  void test("every key follows area.screen.element", () => {
    const invalid = sortedKeys("es-MX").filter((key) => !KEY_CONVENTION.test(key));

    assert.deepEqual(invalid, []);
  });

  for (const locale of locales) {
    void test(`${locale}: messages are not empty and have no unbalanced braces`, () => {
      const invalid = Object.entries(messages[locale]).filter(([, text]) => {
        const withoutPlaceholders = text.replace(PLACEHOLDER, "");
        return text.trim() === "" || STRAY_BRACE.test(withoutPlaceholders);
      });

      assert.deepEqual(invalid, []);
    });
  }
});
