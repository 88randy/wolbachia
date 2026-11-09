import { randomUUID } from "expo-crypto";
import type { SqlExecutor } from "../../db/sql.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { readCaptureShift } from "../ovitrap-check/shift-authorization.ts";
import { SupplyReceiptService } from "./service.ts";
import { ReceiptStore } from "./store.ts";

interface Input {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly attachments: Attachments;
  readonly bundle: DayBundleService;
  readonly shiftOpen: ShiftOpenService;
  readonly engine: SyncEngine;
  readonly evidence: EvidencePort;
}
/** Share the one authenticated projection writer, file journal, camera and SyncEngine. */
export function createSupplyReceipt(input: Input): SupplyReceiptService {
  return new SupplyReceiptService({
    store: new ReceiptStore(input.db),
    bundle: input.bundle,
    attachments: input.attachments,
    engine: input.engine,
    current: input.attachments.session.deps.current,
    canCapture: () => input.auth.getSnapshot().phase === "unlocked",
    shift: () => readCaptureShift(input.shiftOpen),
    photo: input.evidence,
    uuid: randomUUID,
    now: () => new Date(),
  });
}
