import { AppState } from "react-native";
import { acceptedEvidenceOwner } from "../../attachments/accepted-owner.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import { isRulesSnapshot } from "../../auth/rules-snapshot.ts";
import { KV_KEYS, KvStore } from "../../db/kv-store.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { parseLocale } from "../../app/preferences.ts";
import { translate } from "../../i18n/translate.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { ShiftOpenStore } from "../shift-open/store.ts";
import { reconcileOnChange, TrackRecorder } from "./track-recorder.ts";
import type { TrackRecorderDeps } from "./track-recorder.ts";
import { readTrackRules } from "./track-rules.ts";
import { TrackStore } from "./track-store.ts";
import { nativeTrack, setTrackHandler } from "./track-task.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly engine: SyncEngine;
  readonly auth: AuthController;
  readonly credentials: CredentialStore;
  readonly deviceId: string;
  readonly uuid: () => string;
}

/** Same cached snapshot as the session and safety rules (`auth_rules_snapshot`). */
const RULES_KEY = "auth_rules_snapshot";

function ownerOf(deps: Dependencies): string | null {
  const identity = acceptedEvidenceOwner({
    profile: deps.auth.getSnapshot().profile,
    credentials: deps.credentials.getSnapshot(),
    deviceId: deps.deviceId,
  });
  return identity === null ? null : ownerKey(identity.owner);
}

async function readRules(kv: KvStore) {
  const raw = await kv.get(RULES_KEY);
  const parsed: unknown = raw === null ? null : JSON.parse(raw);
  return readTrackRules(isRulesSnapshot(parsed) ? parsed : null);
}

async function notificationTexts(kv: KvStore) {
  const locale = parseLocale(await kv.get(KV_KEYS.locale));
  return {
    title: translate(locale, "mobile.track.notificationTitle"),
    body: translate(locale, "mobile.track.notificationBody"),
  };
}

function recorderDeps(deps: Dependencies): TrackRecorderDeps {
  const kv = new KvStore(deps.db);
  const shift = new ShiftOpenStore(deps.db);
  return {
    store: new TrackStore(deps.db),
    native: nativeTrack,
    identity: () => ownerOf(deps),
    timeZone: () => deps.auth.getSnapshot().profile?.organization?.timezone ?? null,
    rules: () => readRules(kv),
    texts: () => notificationTexts(kv),
    versions: async () => ({
      rules: await shift.rulesVersion(),
      catalog: (await shift.catalog())?.version ?? "",
    }),
    uuid: deps.uuid,
    now: Date.now,
    requestSync: () => void deps.engine.hint(),
    // Structured, no coordinates: only the event and the error class.
    report: (event, error) => {
      console.warn(event, error instanceof Error ? error.name : "unknown");
    },
  };
}

/** Wires the recorder to the native task, the session and the app lifecycle; reconciles once now. */
export function createTrack(deps: Dependencies): TrackRecorder {
  const recorder = new TrackRecorder(recorderDeps(deps));
  setTrackHandler((fixes) => recorder.onFixes(fixes));
  reconcileOnChange({
    subscribe: deps.auth.subscribe,
    key: () => `${deps.auth.getSnapshot().phase}|${ownerOf(deps) ?? ""}`,
    reconcile: recorder.reconcile,
  });
  // Android starts a foreground service only from the foreground: a refused start retries here.
  AppState.addEventListener("change", (state) => {
    if (state === "active") void recorder.reconcile();
  });
  void recorder.reconcile();
  return recorder;
}
