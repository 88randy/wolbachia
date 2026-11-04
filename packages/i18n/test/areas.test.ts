import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, test } from "node:test";
import { messages } from "../src/index.ts";

const LOCALES = ["es-MX", "en"] as const;

/** Areas that have a file in a locale directory (every `.ts` except `index.ts` and `area.ts`). */
function areaFiles(dir: string): string[] {
  return readdirSync(new URL(`../src/locales/${dir}/`, import.meta.url))
    .filter((file) => file.endsWith(".ts") && file !== "index.ts" && file !== "area.ts")
    .map((file) => file.slice(0, -".ts".length))
    .sort();
}

/** Areas (first key segment) used by the composed catalog of a locale. */
function areasInUse(locale: (typeof LOCALES)[number]): string[] {
  return [...new Set(Object.keys(messages[locale]).map((key) => key.split(".")[0] ?? ""))].sort();
}

async function loadArea(dir: string, area: string): Promise<Record<string, string>> {
  const module = (await import(`../src/locales/${dir}/${area}.ts`)) as Record<
    string,
    Record<string, string>
  >;
  return module[area] ?? {};
}

void describe("catalogs split per area (#67)", () => {
  for (const locale of LOCALES) {
    void test(`${locale}: every area used by a key has a file, and the other way round`, () => {
      assert.deepEqual(areaFiles(locale), areasInUse(locale));
    });

    void test(`${locale}: each area file only holds keys of its own area`, async () => {
      for (const area of areaFiles(locale)) {
        const keys = Object.keys(await loadArea(locale, area));
        const foreign = keys.filter((key) => !key.startsWith(`${area}.`));

        assert.notEqual(keys.length, 0, `${locale}/${area}.ts is empty`);
        assert.deepEqual(foreign, [], `${locale}/${area}.ts has keys of another area`);
      }
    });

    void test(`${locale}: composing the area files drops no key (no duplicate overwrote another)`, async () => {
      let total = 0;
      for (const area of areaFiles(locale)) {
        total += Object.keys(await loadArea(locale, area)).length;
      }

      assert.equal(Object.keys(messages[locale]).length, total);
    });
  }
});
