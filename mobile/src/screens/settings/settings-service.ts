import type { AuthController } from "../../auth/auth-controller.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { readInteger } from "../../db/sql.ts";

export interface SettingsState {
  readonly pendingEvents: number;
  readonly pendingFiles: number;
  readonly drafts: number;
  readonly support: string | null;
  readonly runningVersion: string;
  readonly updater: "unavailable";
}

/** Reads truthful local state only. Session access closes through the existing credential writer. */
interface Dependencies {
  readonly db: SqlExecutor;
  readonly auth: Pick<AuthController, "getSnapshot" | "lock">;
  readonly appVersion: string;
}
export class SettingsService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async read(): Promise<SettingsState> {
    const before = this.#deps.auth.getSnapshot();
    const [row] = await this.#deps.db.query(PENDING_SUMMARY);
    const after = this.#deps.auth.getSnapshot();
    if (after.phase !== "unlocked" || before.profile !== after.profile || !row)
      throw new Error("Settings owner unavailable.");
    return {
      pendingEvents: readInteger(row, "events"),
      pendingFiles: readInteger(row, "files"),
      drafts: readInteger(row, "drafts"),
      support: after.profile?.organization?.support_contact.trim() || null,
      runningVersion: this.#deps.appVersion,
      updater: "unavailable",
    };
  }
  lock(): Promise<void> {
    return this.#deps.auth.lock();
  }
}

const PENDING_SUMMARY = `SELECT
  (SELECT COUNT(*) FROM outbox_event WHERE local_status IN ('pending','sending','error')) AS events,
  (SELECT COUNT(*) FROM attachment_file WHERE state<>'verified' OR is_bound=0) AS files,
  (SELECT COUNT(*) FROM (
    SELECT 1 FROM shift_open_state WHERE opening_event_id IS NULL
    UNION ALL SELECT 1 FROM ovitrap_draft WHERE event_id IS NULL
    UNION ALL SELECT 1 FROM lifecycle_draft WHERE event_id IS NULL
    UNION ALL SELECT 1 FROM supply_receipt_draft WHERE event_id IS NULL
    UNION ALL SELECT 1 FROM fuel_draft WHERE event_id IS NULL
    UNION ALL SELECT 1 FROM incident_draft WHERE event_id IS NULL
  )) AS drafts`;
