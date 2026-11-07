import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import type { LifecycleStore } from "./store.ts";
import type {
  LifecycleSourcePort,
  LifecycleSourceOperation,
  LifecycleSourceTurn,
} from "./types.ts";
export interface Dependencies {
  readonly store: LifecycleStore;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly gps: GpsPort;
  readonly evidence: EvidencePort;
  readonly shiftId: () => Promise<string>;
  readonly source?: LifecycleSourcePort;
  readonly refresh?: (
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
  ) => Promise<void>;
}
