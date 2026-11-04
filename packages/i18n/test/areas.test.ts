import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { messages } from "../src/index.ts";

const AREAS = ["common", "errors", "shell", "states", "auth", "sync"] as const;
const DIRS = [
  ["es-MX", "es-MX"],
  ["en", "en"],
] as const;

async function loadArea(dir: string, area: string): Promise<Record<string, string>> {
  const module = (await import(`../src/locales/${dir}/${area}.ts`)) as Record<
    string,
    Record<string, string>
  >;
  return module[area] ?? {};
}

void describe("catalogs split per area (#67)", () => {
  void test("every pre-split key keeps its exact text (snapshot is a floor, new keys are allowed)", () => {
    const snapshot = JSON.parse(
      readFileSync(new URL("./fixtures/catalogs.snapshot.json", import.meta.url), "utf8"),
    ) as Record<string, Record<string, string>>;

    for (const [locale, expected] of Object.entries(snapshot)) {
      const actual = messages[locale as keyof typeof messages];
      const changed = Object.entries(expected).filter(
        ([key, text]) => actual[key as keyof typeof actual] !== text,
      );

      assert.deepEqual(changed, [], `${locale}: pre-split keys missing or changed`);
    }
  });

  void test("every area used by a key has a file, and the other way round", () => {
    const used = [...new Set(Object.keys(messages["es-MX"]).map((key) => key.split(".")[0]))];

    assert.deepEqual(used.sort(), [...AREAS].sort());
  });

  for (const [dir, locale] of DIRS) {
    void test(`${dir}: each area file only holds keys of its own area`, async () => {
      for (const area of AREAS) {
        const keys = Object.keys(await loadArea(dir, area));
        const foreign = keys.filter((key) => !key.startsWith(`${area}.`));

        assert.notEqual(keys.length, 0, `${dir}/${area}.ts is empty`);
        assert.deepEqual(foreign, [], `${dir}/${area}.ts has keys of another area`);
      }
    });

    void test(`${dir}: composing the area files drops no key (no duplicate overwrote another)`, async () => {
      let total = 0;
      for (const area of AREAS) {
        total += Object.keys(await loadArea(dir, area)).length;
      }

      assert.equal(Object.keys(messages[locale]).length, total);
    });
  }
});
