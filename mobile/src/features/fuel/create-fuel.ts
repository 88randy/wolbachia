import { randomUUID } from "expo-crypto";
import type { SqlExecutor } from "../../db/sql.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { FuelService } from "./service.ts";
import { FuelStore } from "./store.ts";
import { FuelError } from "./domain.ts";

interface Input {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly attachments: Attachments;
  readonly bundle: DayBundleService;
  readonly shiftOpen: ShiftOpenService;
  readonly engine: SyncEngine;
  readonly evidence: EvidencePort;
}
/** Motorcycle identity and the original shift guard come from the SAME operational read. */
async function fuelShift(shiftOpen: ShiftOpenService) {
  const { snapshot, guard } = await shiftOpen.readWithGuard(),
    id = captureShiftId(snapshot);
  if (!id || !snapshot.draft) throw new FuelError("shift");
  return {
    id,
    motorcycleCode: snapshot.draft.motorcycle_code,
    odometer: Number(snapshot.draft.odometer_km),
    guard,
  };
}
export function createFuel(input: Input): FuelService {
  return new FuelService({
    ...input,
    store: new FuelStore(input.db),
    current: input.attachments.session.deps.current,
    canCapture: () => input.auth.getSnapshot().phase === "unlocked",
    shift: () => fuelShift(input.shiftOpen),
    photo: input.evidence,
    uuid: randomUUID,
    now: () => new Date(),
  });
}
