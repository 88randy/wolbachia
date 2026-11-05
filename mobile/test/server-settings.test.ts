import assert from "node:assert/strict";
import { it } from "node:test";

import { ServerSettings } from "../src/config/server-settings.ts";
import { KV_KEYS } from "../src/db/kv-store.ts";
import { createStores } from "./support/factories.ts";

void it("release Settings rejects http before saving and ignores an old debug override", async () => {
  const { kv } = await createStores();
  const debug = new ServerSettings(kv, undefined, true);
  await debug.save("http://10.0.0.1");
  const release = new ServerSettings(kv, "https://api.example.com", false);
  await release.load();

  assert.equal(release.baseUrl(), "https://api.example.com");
  assert.deepEqual(await release.save("http://192.168.1.20"), {
    ok: false,
    problem: "cleartextNotAllowed",
  });
  assert.equal(await kv.get(KV_KEYS.apiBaseUrlOverride), "http://10.0.0.1");
});
