import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import type { LifecycleStore } from "./store.ts";
export interface Dependencies {
  readonly store: LifecycleStore;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly gps: GpsPort;
  readonly evidence: EvidencePort;
  readonly shiftId: () => Promise<string>;
  readonly refresh?: () => Promise<void>;
}
