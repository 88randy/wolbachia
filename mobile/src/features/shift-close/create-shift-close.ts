import { captureLocalDate } from "../day/capture-local-date.ts";
import { randomUUID } from "expo-crypto";
import { ownerKey } from "../../attachments/types.ts";
import { acceptedEvidenceOwner } from "../../attachments/accepted-owner.ts";
import { ShiftCloseService } from "./service.ts";
import { buildDay } from "../day/domain.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { DayService } from "../day/service.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly day: DayService;
  readonly bundle: DayBundleService;
  readonly auth: AuthController;
  readonly tokens: CredentialStore;
  readonly deviceId: string;
  readonly attachments: Attachments;
  readonly evidence: EvidencePort;
  readonly engine: SyncEngine;
  readonly shiftOpen: ShiftOpenService;
}
function currentOwner(deps: Dependencies): string | null {
  const identity = acceptedEvidenceOwner({
    profile: deps.auth.getSnapshot().profile,
    credentials: deps.tokens.getSnapshot(),
    deviceId: deps.deviceId,
  });
  return identity === null ? null : ownerKey(identity.owner);
}
async function pendingPoints(day: DayService) {
  const snapshot = await day.read();
  return buildDay({
    ...snapshot,
    location: { kind: "unavailable" },
    now: new Date(),
  }).pendingTasks.map(({ task }) => ({ taskId: task.id, pointCode: task.point_code }));
}
/** Close uses the existing short projection writer and actual session owner; no capture awaits network. */
export function createShiftClose(deps: Dependencies): ShiftCloseService {
  let revision = 0;
  deps.auth.subscribe(() => {
    revision += 1;
  });
  return new ShiftCloseService({
    db: deps.db,
    now: () => new Date(),
    uuid: randomUUID,
    identity: () => currentOwner(deps),
    admission: () =>
      deps.auth.getSnapshot().phase === "unlocked" &&
      deps.auth.getSnapshot().profile?.permissions.includes("field_event.sync")
        ? String(revision)
        : null,
    canReconcile: () =>
      deps.auth.getSnapshot().profile?.permissions.includes("supply_assignment.reconcile") ?? false,
    localDate: (instant) =>
      captureLocalDate(instant, deps.auth.getSnapshot().profile?.organization?.timezone),
    serialize: (write) => deps.bundle.captureProjectionWriter()(write),
    pending: () => pendingPoints(deps.day),
    attachments: deps.attachments,
    photos: deps.evidence,
    notify: () => {
      deps.day.stopLocation();
      deps.shiftOpen.notifyLocalClose();
      void deps.engine.hint();
    },
  });
}
