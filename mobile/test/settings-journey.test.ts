import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsService } from "../src/screens/settings/settings-service.ts";
import { deriveAuthSnapshot } from "../src/auth/auth-state.ts";
import { readAuthRules } from "../src/auth/auth-rules.ts";
import { makeCredentials } from "./support/auth-fakes.ts";
import { createStores, makeEnvelope } from "./support/factories.ts";
import { componentHarness } from "./support/m-09-render.ts";
import { messages } from "@wolbachia/i18n";

void test("closing local access explains pending work and retains credentials, draft, files and original UUID", async () => {
  const { credentials } = await makeCredentials();
  await credentials.runExclusive((transaction) =>
    transaction.grantUnlock(credentials.unlockGate()),
  );
  const { db, outbox } = await createStores();
  const event = makeEnvelope();
  await outbox.enqueue(event);
  await db.runAtomically([
    {
      sql: "INSERT INTO shift_open_state(slot,draft) VALUES(1,?)",
      params: [JSON.stringify({ eventId: "draft-original" })],
    },
    {
      sql: "INSERT INTO attachment_file(id,owner_key,draft_id) VALUES('file','owner','draft-original')",
    },
  ]);
  const originalCredentials = credentials.getSnapshot();
  const service = new SettingsService({
    db,
    appVersion: "0.0.0",
    auth: {
      lock: () => credentials.lock(),
      getSnapshot: () =>
        deriveAuthSnapshot({
          credentials: credentials.getSnapshot(),
          isUnlocked: credentials.isUnlocked(),
          context: {
            profile: null,
            rules: readAuthRules(null),
            notice: null,
            hasClockSkew: false,
            isOnline: false,
          },
        }),
    },
  });
  const state = await service.read();
  assert.deepEqual([state.pendingEvents, state.pendingFiles, state.drafts], [1, 1, 1]);
  assert.equal(state.updater, "unavailable");
  assert.equal(state.support, null);
  await service.lock();
  assert.equal(credentials.isUnlocked(), false);
  assert.deepEqual(credentials.getSnapshot(), originalCredentials);
  assert.equal((await db.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
  assert.equal(
    (await db.query("SELECT draft FROM shift_open_state"))[0]?.draft,
    JSON.stringify({ eventId: "draft-original" }),
  );
  assert.equal((await db.query("SELECT id FROM attachment_file"))[0]?.id, "file");
});

void test("P31 support, pending-work and lock actions remain labelled in both themes and languages at130percent", () => {
  for (const locale of ["es-MX", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const renderer = componentHarness({ locale, scheme, fontScale: 1.3 });
      const nodes = renderer.render(
        "mobile/src/screens/settings/SettingsStateView.tsx",
        "SettingsStateView",
        {
          state: {
            pendingEvents: 2,
            pendingFiles: 1,
            drafts: 1,
            support: null,
            runningVersion: "0.0.0",
            updater: "unavailable",
          },
          hasError: false,
          onLock: () => undefined,
          onInbox: () => undefined,
          onRetry: () => undefined,
        },
      );
      const labels = nodes
        .filter((node) => node.type === "Text")
        .map((node) => node.props.children);
      assert.ok(labels.includes(messages[locale]["mobile.settings.updaterUnavailable"]));
      assert.ok(labels.includes(messages[locale]["mobile.settings.lockHint"]));
      assert.ok(labels.includes(messages[locale]["mobile.settings.lockAccess"]));
      assert.equal(nodes.filter((node) => node.props.accessibilityRole === "button").length, 3);
      assert.ok(
        nodes.every(
          (node) => node.props.numberOfLines === undefined && node.props.allowFontScaling !== false,
        ),
      );
    }
  }
});
