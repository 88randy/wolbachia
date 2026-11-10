import assert from "node:assert/strict";
import { test } from "node:test";

import { KvStore } from "../src/db/kv-store.ts";
import { PreferenceStore } from "../src/app/preference-store.ts";
import { createTestDatabase } from "./support/sqlite-executor.ts";

void test("settings survive controller restart per user without changing retained work", async () => {
  const kv = new KvStore(await createTestDatabase());
  await kv.set("retained_draft", "original draft");
  const first = new PreferenceStore(kv, "org:user");
  assert.equal(await first.change({ locale: "en", scheme: "dark", textSize: "large" }), true);
  const restarted = new PreferenceStore(kv, "org:user");
  await restarted.load();
  assert.equal(restarted.getSnapshot().locale, "en");
  assert.equal(restarted.getSnapshot().scheme, "dark");
  assert.equal(restarted.getSnapshot().textSize, "large");
  const another = new PreferenceStore(kv, "other:user");
  await another.load();
  assert.equal(another.getSnapshot().locale, "es-MX");
  assert.equal(await kv.get("retained_draft"), "original draft");
});

void test("failed preference persistence retains selected values and permits retry", async () => {
  const kv = new KvStore(await createTestDatabase());
  let shouldFail = true;
  const store = new PreferenceStore(
    {
      get: (key) => kv.get(key),
      set: async (key, value) => {
        if (shouldFail) throw new Error("Storage full");
        await kv.set(key, value);
      },
    },
    "org:user",
  );
  assert.equal(await store.change({ locale: "en" }), false);
  assert.equal(store.getSnapshot().locale, "es-MX");
  assert.equal(store.getSnapshot().hasError, true);
  shouldFail = false;
  assert.equal(await store.change({ locale: "en" }), true);
  assert.equal(store.getSnapshot().locale, "en");
  assert.equal(store.getSnapshot().hasError, false);
});

void test("rapid independent preference choices serialize without overwriting each other", async () => {
  const kv = new KvStore(await createTestDatabase());
  const store = new PreferenceStore(kv, "org:user");
  await Promise.all([store.change({ locale: "en" }), store.change({ scheme: "light" })]);
  const restarted = new PreferenceStore(kv, "org:user");
  await restarted.load();
  assert.equal(restarted.getSnapshot().locale, "en");
  assert.equal(restarted.getSnapshot().scheme, "light");
});
