import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import { filterHistory } from "./domain.ts";
import type { HistoryView } from "./domain.ts";
import { readHistory } from "./store.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly auth: Pick<AuthController, "getSnapshot" | "subscribe">;
  readonly bundle: Pick<DayBundleService, "captureProjectionWriter" | "subscribe" | "refresh">;
  readonly current: () => EvidenceIdentity | null;
}
/** Reads existing immutable facts only; writes/retries remain owned by the original outbox. */
export class HistoryService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async read(search = ""): Promise<HistoryView> {
    const original = this.#deps.current(),
      auth = this.#deps.auth.getSnapshot();
    if (!original || auth.phase !== "unlocked") return { available: false, entries: [] };
    const key = JSON.stringify([ownerKey(original.owner), original.sessionId]);
    const write = this.#deps.bundle.captureProjectionWriter();
    const view = await write(() =>
      readHistory(this.#deps.db, original, auth.profile?.username ?? original.owner.userId),
    );
    const current = this.#deps.current();
    if (
      !current ||
      this.#deps.auth.getSnapshot().phase !== "unlocked" ||
      JSON.stringify([ownerKey(current.owner), current.sessionId]) !== key
    )
      return { available: false, entries: [] };
    return { ...view, entries: filterHistory(view.entries, search) };
  }
  refresh = () => this.#deps.bundle.refresh();
  subscribe = (listener: () => void) => {
    const stopAuth = this.#deps.auth.subscribe(listener),
      stopBundle = this.#deps.bundle.subscribe(listener);
    return () => {
      stopAuth();
      stopBundle();
    };
  };
}
export function createHistory(deps: Dependencies): HistoryService {
  return new HistoryService(deps);
}
