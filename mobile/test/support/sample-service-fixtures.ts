import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AttachmentStore } from "../../src/attachments/attachment-store.ts";
import { EvidenceSession } from "../../src/attachments/evidence-session.ts";
import { EvidenceCapture } from "../../src/attachments/capture-evidence.ts";
import { AttachmentSync } from "../../src/attachments/attachment-sync.ts";
import type { AttachmentTransport } from "../../src/attachments/attachment-transport.ts";
import type { EvidencePort, GpsPort } from "../../src/features/ovitrap-check/types.ts";
import { DayBundleService } from "../../src/features/day/bundle-service.ts";
import { DayStore } from "../../src/features/day/store.ts";
import { SampleStore } from "../../src/features/samples/store.ts";
import { SampleService } from "../../src/features/samples/service.ts";
import { SampleError } from "../../src/features/samples/types.ts";
import type { SampleSelection } from "../../src/features/samples/types.ts";
import { KvStore, setStatement } from "../../src/db/kv-store.ts";
import type { SqlExecutor } from "../../src/db/sql.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { SyncEngine } from "../../src/sync/sync-engine.ts";
import type { SyncBatchRequest } from "../../src/sync/sync-transport.ts";
import { openTestDatabase } from "./sqlite-executor.ts";
import { nodePrivateFiles, PNG_BYTES } from "./attachment-fixtures.ts";
import { answer } from "./scripted-transport.ts";
import { PROJECTION_IDENTITY } from "./lifecycle-projection-fixtures.ts";
import {
  SAMPLE_NOW,
  sampleBundle,
  sampleCatalog,
  sampleId,
  sampleProfile,
  sampleSource,
} from "./sample-fixtures.ts";

const SHIFT_KEY = "sample_test_shift";
export const SAMPLE_SELECTION: SampleSelection = {
  sampleId: null,
  sourceRef: { kind: "lot", id: sampleSource().id },
  manualCapture: false,
};
function offlineEngine(outbox: OutboxRepository, requests: SyncBatchRequest[], kv: KvStore) {
  return new SyncEngine({
    pass: {
      outbox,
      kv,
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => SAMPLE_NOW,
      transport: (request) => {
        requests.push(request);
        return Promise.resolve(answer([]));
      },
    },
    hasSession: () => false,
    hasPendingFinalUpload: () => Promise.resolve(false),
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      throw error;
    },
  });
}
/** Ordinary SQLite/private files plus scripted transport, never a native or live-server claim. */
export class SampleHarness {
  readonly directory: string;
  readonly source: string;
  database: Awaited<ReturnType<typeof openTestDatabase>>;
  clock = SAMPLE_NOW;
  body = sampleBundle();
  isUnlocked = true;
  uuid = 100;
  photoId = 500;
  gpsCalls = 0;
  readonly requests: SyncBatchRequest[] = [];
  readonly uploaded: string[] = [];
  camera: EvidencePort["capture"];
  gps: GpsPort["locate"];
  local: ReturnType<SampleHarness["compose"]>;
  constructor(directory: string, database: Awaited<ReturnType<typeof openTestDatabase>>) {
    this.directory = directory;
    this.source = join(directory, "source.png");
    this.database = database;
    this.camera = () =>
      Promise.resolve({ id: sampleId(++this.photoId), fileRef: pathToFileURL(this.source).href });
    this.gps = () => {
      this.gpsCalls += 1;
      return Promise.resolve({ lat: 19, lng: -99, accuracy_m: this.gpsCalls + 5 });
    };
    this.local = this.compose(database.executor);
  }
  uploadTransport(): AttachmentTransport {
    const grant = { lease: "synthetic-sample-grant", contentType: "image/png" as const };
    return {
      authorize: () => Promise.resolve({ state: "authorized", verifiedAt: null, grant }),
      renew: () => Promise.resolve({ state: "authorized", verifiedAt: null, grant }),
      put: (call, bytes) => {
        assert.deepEqual(Buffer.from(bytes), PNG_BYTES);
        this.uploaded.push(call.file.id);
        return Promise.resolve();
      },
      finalize: () => Promise.resolve(this.clock.toISOString()),
    };
  }
  createAttachments(db: SqlExecutor) {
    const store = new AttachmentStore(db),
      session = new EvidenceSession({
        store,
        current: () => PROJECTION_IDENTITY,
        isFinal: () => false,
      });
    const files = nodePrivateFiles(join(this.directory, "owned"));
    return {
      store,
      session,
      capture: new EvidenceCapture({ store, session, files }),
      sync: new AttachmentSync({
        store,
        session,
        files,
        now: () => this.clock,
        transport: this.uploadTransport(),
      }),
    };
  }
  compose(db: SqlExecutor) {
    const store = new SampleStore(db),
      attachments = this.createAttachments(db),
      kv = new KvStore(db),
      outbox = new OutboxRepository(db, () => this.clock);
    const bundle = new DayBundleService({
      store: new DayStore(db),
      now: () => this.clock,
      getCaptureIdentity: () => PROJECTION_IDENTITY,
      transport: () => Promise.resolve({ kind: "bundle", body: this.body }),
    });
    const engine = offlineEngine(outbox, this.requests, kv);
    const service = this.createService({ db, store, attachments, bundle, engine });
    return { db, store, attachments, bundle, engine, outbox, kv, service };
  }
  createService(input: {
    db: SqlExecutor;
    store: SampleStore;
    attachments: ReturnType<SampleHarness["createAttachments"]>;
    bundle: DayBundleService;
    engine: SyncEngine;
  }): SampleService {
    return new SampleService({
      ...input,
      current: () => PROJECTION_IDENTITY,
      canCapture: () => this.isUnlocked,
      shift: async () => {
        const [row] = await input.db.query("SELECT value FROM kv WHERE key=?", [SHIFT_KEY]);
        if (!row) throw new SampleError("shift");
        return {
          id: sampleId(8),
          guard: {
            sql: "SELECT 1 FROM kv WHERE key=? AND value=?",
            params: [SHIFT_KEY, String(row.value)],
          },
        };
      },
      timezone: () => "America/Mexico_City",
      photo: { capture: (context) => this.camera(context) },
      gps: { locate: () => this.gps() },
      uuid: () => sampleId(++this.uuid),
      now: () => this.clock,
    });
  }
  async initialize(): Promise<void> {
    await this.local.db.runAtomically([
      setStatement("session_profile", JSON.stringify(sampleProfile())),
      setStatement(SHIFT_KEY, sampleId(8)),
      setStatement("shift_open_catalog", JSON.stringify(sampleCatalog())),
      setStatement("shift_open_rules", JSON.stringify({ version: "rules-sample-v1" })),
    ]);
    await this.local.bundle.refresh();
  }
  async reopen(): Promise<void> {
    await this.local.engine.requestSync();
    this.database.close();
    this.database = await openTestDatabase(join(this.directory, "phone.sqlite"));
    this.local = this.compose(this.database.executor);
  }
  async closeShift(): Promise<void> {
    await this.local.db.runAtomically([{ sql: "DELETE FROM kv WHERE key=?", params: [SHIFT_KEY] }]);
  }
}
export async function sampleHarness(context: TestContext): Promise<SampleHarness> {
  const results = fileURLToPath(new URL("../../../test-results/", import.meta.url));
  await mkdir(results, { recursive: true });
  const directory = await mkdtemp(join(results, "m-10-samples-139-"));
  await mkdir(join(directory, "owned"));
  await writeFile(join(directory, "source.png"), PNG_BYTES);
  const harness = new SampleHarness(
    directory,
    await openTestDatabase(join(directory, "phone.sqlite")),
  );
  context.after(async () => {
    harness.database.close();
    assert.ok(
      resolve(directory).startsWith(resolve(results) + "/") ||
        resolve(directory).startsWith(resolve(results) + "\\"),
    );
    await rm(directory, { recursive: true });
  });
  await harness.initialize();
  return harness;
}
