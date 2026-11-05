import { OvitrapStore } from "../../src/features/ovitrap-check/store.ts";
import { OvitrapService } from "../../src/features/ovitrap-check/service.ts";
import { SyncEngine } from "../../src/sync/sync-engine.ts";
import { createStores, FIXED_NOW, FIXED_DEVICE_ID } from "./factories.ts";
import type { TestStores } from "./factories.ts";
import { scriptedTransport, answer } from "./scripted-transport.ts";
import { CATALOG, RULES, ASSIGNMENT } from "./m-08-fixtures.ts";
export function engineFor(
  local: TestStores,
  transport = scriptedTransport([answer([])]).transport,
  hasSession = false,
) {
  return new SyncEngine({
    pass: {
      ...local,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport,
    },
    hasSession: () => hasSession,
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: () => undefined,
  });
}
const PORTS = {
  gps: { locate: () => Promise.resolve({ lat: 19, lng: -99, accuracy_m: 5 }) },
  scanner: {
    scan: () =>
      Promise.resolve({
        status: "read" as const,
        value: "wbf:1:bag:33333333-3333-4333-8333-333333333333",
      }),
  },
  evidence: {
    capture: () =>
      Promise.resolve({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        fileRef: "file:///evidence/test.jpg",
      }),
  },
} as const;
let sequence = 0;
function serviceFor(
  deps: { store: OvitrapStore; engine: SyncEngine },
  overrides: Partial<ConstructorParameters<typeof OvitrapService>[0]>,
) {
  const { store, engine } = deps;
  return new OvitrapService({
    store,
    engine,
    now: () => FIXED_NOW,
    uuid: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
    ...PORTS,
    shiftId: () => Promise.resolve("55555555-5555-4555-8555-555555555555"),
    ...overrides,
  });
}
export async function harness(
  stores?: TestStores,
  overrides: Partial<ConstructorParameters<typeof OvitrapService>[0]> = {},
) {
  const local = stores ?? (await createStores());
  const engine = engineFor(local);
  const store = new OvitrapStore(local.db);
  await store.saveSnapshots({ catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT });
  const service = serviceFor({ store, engine }, overrides);
  return { ...local, engine, store, service };
}
export async function prepareCheck(service: OvitrapService): Promise<void> {
  await service.update({
    finding: "fine",
    paddlePresent: true,
    hasEggs: true,
    paddleType: "standard",
    prepared: ["clean", "water", "liner"],
    bagCode: "B-TEST",
    reviewAcknowledged: true,
  });
}
