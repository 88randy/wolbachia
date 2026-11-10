import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { DayStore } from "../src/features/day/store.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { readScannerResources } from "../src/features/scanner/resource-source.ts";
import { ScannerService } from "../src/features/scanner/service.ts";
import { OvitrapDraftBuffer } from "../src/features/ovitrap-check/draft-buffer.ts";
import { createStores } from "./support/factories.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  PROJECTION_POINT,
  PROJECTION_TRAP,
  projectionBundle,
} from "./support/lifecycle-projection-fixtures.ts";
import { ASSIGNMENT, CATALOG, RULES, makeDraft } from "./support/m-08-fixtures.ts";

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const POINT = { id: PROJECTION_POINT.id, code: PROJECTION_POINT.code, lat: 19, lng: -99 };
const CURRENT_ASSIGNMENT = {
  ...ASSIGNMENT,
  points: [POINT],
  ovitraps: [{ id: PROJECTION_TRAP.id, point: POINT }],
};
function supplyAssignment() {
  return {
    id: id(1),
    courier_id: PROJECTION_IDENTITY.owner.userId,
    organization_id: PROJECTION_IDENTITY.owner.organizationId,
    origin_id: id(2),
    center_id: CONTRACT_IDS.center,
    quadrant_id: null,
    date: "2026-11-06",
    shift_id: null,
    revision: 1,
    version_id: id(3),
    planning_proof: {},
    lines: [
      { id: id(4), lot_id: id(5), piece_id: null, unit_version_id: id(6), quantity: "2.000000" },
    ],
    reconciliation: null,
    releases: [],
    receipts: [],
  };
}
async function scannerFixture(isRetired = false) {
  const { db } = await createStores();
  const capture = new OvitrapStore(db);
  await capture.publishSnapshots(
    { assignment: CURRENT_ASSIGNMENT, catalog: CATALOG, rules: RULES },
    await capture.assignmentAuthority(),
  );
  const profile = {
    issuer: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    userId: PROJECTION_IDENTITY.owner.userId,
    organization: {
      id: PROJECTION_IDENTITY.owner.organizationId,
      timezone: "America/Mexico_City",
      epi_week: "iso",
    },
    permissions: ["supply_assignment.receive", "field.upload"],
  };
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile))]);
  await new AttachmentStore(db).bindSession(PROJECTION_IDENTITY);
  const own = supplyAssignment();
  const body = {
    ...projectionBundle(),
    ovitraps: [{ ...PROJECTION_TRAP, is_retired: isRetired }],
    supplies: [
      own,
      { ...own, id: id(7), courier_id: id(8) },
      { ...own, id: id(9), organization_id: id(10) },
    ],
  };
  const bundle = new DayBundleService({
    store: new DayStore(db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  await bundle.refresh();
  const read = () =>
    bundle.captureLifecycleSource()(null, (turn) => readScannerResources(db, turn));
  return { db, capture, bundle, body, read };
}

void test("M07 local resources retain actual supply pins and exclude foreign or wrong-courier custody", async () => {
  const fixture = await scannerFixture();
  const resources = await fixture.read();
  const scanner = new ScannerService({
    read: () => fixture.bundle.captureLifecycleSource(),
    resources: (turn) => readScannerResources(fixture.db, turn),
    ovitrap: {
      draftBuffer: new OvitrapDraftBuffer(),
      update: () => Promise.reject(new Error("Supply routing cannot edit a capture.")),
      startCheck: () => Promise.reject(new Error("Supply routing cannot begin a capture.")),
      enterBag: () => Promise.reject(new Error("Supply routing cannot change a bag.")),
    },
  });
  assert.deepEqual(
    await scanner.open({
      input: { value: `wbf:1:lot:${id(5)}`, isManual: false },
      eventId: null,
      isCurrent: () => true,
    }),
    { route: { name: "supplyDetail", lotId: id(5) } },
  );
  for (const kind of ["lot", "release-device", "sample"])
    assert.deepEqual(await scanner.resolve({ value: `wbf:1:${kind}:${id(99)}`, isManual: false }), {
      error: "unavailable",
    });
  assert.deepEqual(resources, [
    { kind: "ovitrap", id: PROJECTION_TRAP.id, code: PROJECTION_POINT.code, isRetired: false },
    {
      kind: "lot",
      id: id(5),
      code: null,
      supply: {
        assignmentId: id(1),
        revision: 1,
        date: "2026-11-06",
        lineId: id(4),
        unitId: id(6),
        expected: "2.000000",
      },
    },
  ]);
  assert.equal((await fixture.db.query("SELECT * FROM outbox_event")).length, 0);
  const [originalLine] = supplyAssignment().lines;
  assert.ok(originalLine);
  fixture.body.supplies = [
    {
      ...supplyAssignment(),
      lines: [...supplyAssignment().lines, { ...originalLine, id: id(11) }],
    },
  ];
  await fixture.bundle.refresh(true);
  assert.equal(
    (await fixture.read()).filter((resource) => resource.kind === "lot").length,
    2,
    "the routing domain must see ambiguous lot lines rather than an arbitrary first match",
  );
});

void test("M07 bag routing uses only current assignment and an unsaved canonically scoped capture", async () => {
  const fixture = await scannerFixture();
  await fixture.capture.begin(
    makeDraft({ point: POINT, ovitrapId: PROJECTION_TRAP.id, assignment: CURRENT_ASSIGNMENT }),
  );
  const bags = () =>
    fixture.read().then((resources) => resources.filter(({ kind }) => kind === "bag"));
  assert.deepEqual(
    await bags(),
    CURRENT_ASSIGNMENT.bags.map((bag) => ({ kind: "bag", ...bag })),
  );
  await fixture.capture.publishSnapshots(
    { assignment: { ...CURRENT_ASSIGNMENT, bags: [] }, catalog: CATALOG, rules: RULES },
    await fixture.capture.assignmentAuthority(),
  );
  await fixture.bundle.refresh(true);
  assert.deepEqual(await bags(), [], "historical draft assignment cannot restore a removed bag");
});

void test("M07 retired identity stays explicit and stale authority or storage failures cannot yield resources", async () => {
  const fixture = await scannerFixture(true);
  assert.equal((await fixture.read()).find(({ kind }) => kind === "ovitrap")?.isRetired, true);
  const turn = await fixture.bundle.captureLifecycleSource()(null, (source) =>
    Promise.resolve(source),
  );
  const broken = { ...fixture.db, query: () => Promise.reject(new Error("storage read failed")) };
  await assert.rejects(readScannerResources(broken, turn), /storage read failed/);
  await fixture.bundle.clearSessionData();
  await assert.rejects(readScannerResources(fixture.db, turn));
});
