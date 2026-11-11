import type { Schemas } from "@wolbachia/api-client";
import type { TestContext } from "node:test";
import { attachmentHarness, NOW } from "./attachment-fixtures.ts";
import { PROJECTION_IDENTITY, projectionBundle } from "./lifecycle-projection-fixtures.ts";
import { CONTRACT_IDS } from "./lifecycle-contract-fixtures.ts";
import { DayStore } from "../../src/features/day/store.ts";
import { DayBundleService } from "../../src/features/day/bundle-service.ts";
import { ReceiptStore } from "../../src/features/supply-receipt/store.ts";
import { SupplyReceiptService } from "../../src/features/supply-receipt/service.ts";
import { EvidenceSession } from "../../src/attachments/evidence-session.ts";
import type { EvidenceIdentity } from "../../src/attachments/evidence-session.ts";
import { AttachmentStore } from "../../src/attachments/attachment-store.ts";
import { EvidenceCapture } from "../../src/attachments/capture-evidence.ts";
import { AttachmentSync } from "../../src/attachments/attachment-sync.ts";
import type { AttachmentTransport } from "../../src/attachments/attachment-transport.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { SyncEngine } from "../../src/sync/sync-engine.ts";
import { KvStore, setStatement } from "../../src/db/kv-store.ts";
import type { SqlExecutor } from "../../src/db/sql.ts";
import type { PrivateFiles } from "../../src/attachments/owned-files.ts";
import { answer } from "./scripted-transport.ts";

export const receiptId = (suffix: number) =>
  `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
export const RECEIPT_SIGNATURE_ID = receiptId(60);
export function supplyAssignment(): Schemas["SupplyBundle"] {
  return {
    id: receiptId(1),
    courier_id: PROJECTION_IDENTITY.owner.userId,
    organization_id: PROJECTION_IDENTITY.owner.organizationId,
    origin_id: receiptId(2),
    center_id: CONTRACT_IDS.center,
    quadrant_id: null,
    date: "2026-11-06",
    shift_id: null,
    revision: 1,
    version_id: receiptId(4),
    planning_proof: {},
    lines: expectedLines(),
    reconciliation: null,
    releases: [supplyRelease()],
    receipts: [],
  };
}
function expectedLines(): Schemas["AssignmentLine"][] {
  return [
    {
      id: receiptId(5),
      lot_id: receiptId(6),
      piece_id: null,
      unit_version_id: receiptId(7),
      quantity: "2.000000",
    },
  ];
}
function supplyRelease(): Schemas["SupplyReleaseBundle"] {
  return {
    id: receiptId(8),
    plan_revision: 1,
    manifest_hash: "a".repeat(64),
    warehouse_signed: false,
    lines: [
      {
        id: receiptId(9),
        assignment_line_id: receiptId(5),
        quantity: "2.000000",
        transit_policy_id: null,
      },
    ],
  };
}
export const RECEIPT_PROFILE = {
  issuer: PROJECTION_IDENTITY.owner.issuer,
  sessionId: PROJECTION_IDENTITY.sessionId,
  userId: PROJECTION_IDENTITY.owner.userId,
  organization: { id: PROJECTION_IDENTITY.owner.organizationId },
  permissions: ["field_event.sync", "supply_assignment.receive", "field.upload"],
};
const unavailable = () => Promise.reject(new Error("Unexpected file transport in local capture"));
export const NO_FILE_TRANSPORT: AttachmentTransport = {
  authorize: unavailable,
  renew: unavailable,
  put: unavailable,
  finalize: unavailable,
};
interface CompositionInput {
  readonly db: SqlExecutor;
  readonly files: PrivateFiles;
  readonly source: string;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly assignment: () => Schemas["SupplyBundle"];
  readonly uuid: () => string;
}
function fixtureAttachments(input: CompositionInput) {
  const { db, current, files } = input;
  const store = new AttachmentStore(db);
  const session = new EvidenceSession({ store, current, isFinal: () => current() === null });
  const capture = new EvidenceCapture({ store, session, files });
  const sync = new AttachmentSync({
    store,
    session,
    files,
    now: () => NOW,
    transport: NO_FILE_TRANSPORT,
  });
  return { store, session, capture, sync };
}
function fixtureBundle(input: CompositionInput) {
  return new DayBundleService({
    store: new DayStore(input.db),
    now: () => NOW,
    getCaptureIdentity: input.current,
    transport: () =>
      Promise.resolve({
        kind: "bundle",
        body: { ...projectionBundle(), supplies: [input.assignment()] },
      }),
  });
}
function receiptComposition(input: CompositionInput) {
  const { db, current } = input;
  const attachments = fixtureAttachments(input);
  const outbox = new OutboxRepository(db, () => NOW),
    kv = new KvStore(db);
  const bundle = fixtureBundle(input);
  const engine = localEngine({ outbox, kv });
  const photo = {
    capture: () => Promise.resolve({ id: RECEIPT_SIGNATURE_ID, fileRef: input.source }),
  };
  const service = new SupplyReceiptService({
    store: new ReceiptStore(db),
    attachments,
    bundle,
    engine,
    current,
    canCapture: input.canCapture,
    shift: () => Promise.resolve({ id: receiptId(50), guard: { sql: "SELECT 1" } }),
    photo,
    uuid: input.uuid,
    now: () => NOW,
  });
  return { db, outbox, kv, attachments, bundle, service, engine, photo };
}
function localEngine(stores: { outbox: OutboxRepository; kv: KvStore }) {
  return new SyncEngine({
    pass: {
      ...stores,
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => NOW,
      transport: () => Promise.resolve(answer([])),
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
/** Real files and a reopenable SQLite journal; only the native/HTTP boundaries are ports. */
export async function receiptHarness(test: TestContext) {
  const local = await attachmentHarness(test);
  const state = mutableFixtureState();
  const build = (db: SqlExecutor) =>
    receiptComposition({
      db: failingExecutor(db, state),
      files: local.files,
      source: local.source,
      current: () => state.identity,
      canCapture: () => state.canCapture,
      assignment: () => state.assignment,
      uuid: () => receiptId(state.sequence++),
    });
  const initial = build(local.db);
  await seedConfiguration(initial.db);
  await initial.bundle.refresh();
  return {
    ...initial,
    files: local.files,
    source: local.source,
    ...fixtureControls(state),
    reopen: async () => build((await local.reopen()).db),
  };
}
function fixtureControls(state: ReturnType<typeof mutableFixtureState>) {
  return {
    setCaptureAllowed: (canCapture: boolean) => {
      state.canCapture = canCapture;
    },
    setIdentity: (next: EvidenceIdentity | null) => {
      state.identity = next;
    },
    setAssignment: (next: Schemas["SupplyBundle"]) => {
      state.assignment = next;
    },
    failSave: () => {
      state.shouldFailSave = true;
    },
  };
}
function mutableFixtureState() {
  return {
    identity: PROJECTION_IDENTITY as EvidenceIdentity | null,
    assignment: supplyAssignment(),
    sequence: 100,
    shouldFailSave: false,
    canCapture: true,
  };
}
function failingExecutor(
  db: SqlExecutor,
  state: ReturnType<typeof mutableFixtureState>,
): SqlExecutor {
  return {
    ...db,
    runAtomically: (statements) => {
      if (
        state.shouldFailSave &&
        statements.some(({ sql }) => sql.startsWith("INSERT INTO outbox_event"))
      ) {
        state.shouldFailSave = false;
        return Promise.reject(new Error("Synthetic full storage"));
      }
      return db.runAtomically(statements);
    },
  };
}
function seedConfiguration(db: SqlExecutor) {
  return db.runAtomically([
    setStatement("session_profile", JSON.stringify(RECEIPT_PROFILE)),
    setStatement("shift_open_catalog", JSON.stringify({ version: "catalog-m05" })),
    setStatement("shift_open_rules", JSON.stringify({ version: "rules-m05" })),
  ]);
}
