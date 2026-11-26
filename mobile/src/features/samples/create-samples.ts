import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { DayService } from "../day/service.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import { ForegroundLifecycleGps } from "../ovitrap-lifecycle/foreground-gps.ts";
import { SampleService } from "./service.ts";
import { SampleStore } from "./store.ts";
import { SampleError } from "./types.ts";
interface Input {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly attachments: Attachments;
  readonly bundle: DayBundleService;
  readonly day: DayService;
  readonly shiftOpen: ShiftOpenService;
  readonly engine: SyncEngine;
  readonly evidence: EvidencePort;
}
async function shift(shiftOpen: ShiftOpenService) {
  const { snapshot, guard } = await shiftOpen.readWithGuard(),
    id = captureShiftId(snapshot);
  if (!id) throw new SampleError("shift");
  return { id, guard };
}
export function createSamples(input: Input): SampleService {
  return new SampleService({
    ...input,
    store: new SampleStore(input.db),
    current: input.attachments.session.deps.current,
    canCapture: () => input.auth.getSnapshot().phase === "unlocked",
    shift: () => shift(input.shiftOpen),
    timezone: () => input.auth.getSnapshot().profile?.organization?.timezone ?? null,
    uuid: randomUUID,
    now: () => new Date(),
    photo: input.evidence,
    gps: gps(input.day),
  });
}
function gps(day: DayService) {
  return new ForegroundLifecycleGps({
    source: day.location,
    now: () => new Date(),
    activity: {
      isActive: () => (AppState.currentState ?? "active") === "active",
      subscribe: (listener) => {
        const subscription = AppState.addEventListener("change", listener);
        return () => {
          subscription.remove();
        };
      },
    },
    schedule: (callback, delayMs) => {
      const timer = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(timer);
      };
    },
  });
}
