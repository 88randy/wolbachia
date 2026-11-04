import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultLocale, messages } from "../src/index.ts";
import type { Locale } from "../src/index.ts";

const KEY_CONVENTION = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const STRAY_BRACE = /[{}]/;

const locales = Object.keys(messages) as Locale[];

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
  void test("only errors.api.blocked takes a placeholder, and it is {role}", () => {
    const withPlaceholders = Object.entries(messages["es-MX"])
      .filter(([, text]) => placeholdersOf(text).length > 0)
      .map(([key, text]) => [key, placeholdersOf(text)]);

    assert.deepEqual(withPlaceholders, [["errors.api.blocked", ["role"]]]);
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
