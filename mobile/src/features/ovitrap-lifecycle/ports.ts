import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import type { LifecycleStore } from "./store.ts";
import type { Evidence } from "../ovitrap-check/types.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { LifecycleDraft } from "./types.ts";
import type {
  LifecycleSourcePort,
  LifecycleSourceOperation,
  LifecycleSourceTurn,
  LifecycleAdmission,
} from "./types.ts";
export interface Dependencies {
  readonly store: LifecycleStore;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly gps: GpsPort;
  readonly evidence: EvidencePort;
  readonly captureEvidence?: (
    draftId: string,
    admission: LifecycleAdmission,
  ) => Promise<Evidence | null>;
  readonly evidenceBindings?: (
    draft: LifecycleDraft,
    turn: LifecycleSourceTurn,
  ) => Promise<readonly SqlStatement[]>;
  readonly cancelNative?: () => void;
  readonly selectTask?: (
    id: string,
    expected: import("../day/current-task.ts").TaskOwner,
    admission: LifecycleAdmission,
  ) => Promise<unknown>;
  readonly shiftId: () => Promise<string>;
  readonly source?: LifecycleSourcePort;
  readonly refresh?: (
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
  ) => Promise<void>;
  readonly refreshAdvisory?: (
    draft: LifecycleDraft,
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
  ) => Promise<void>;
}
