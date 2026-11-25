import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import { captureLocalDate } from "../day/capture-local-date.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { HistoryService } from "../history/service.ts";
import { buildCalendar, resolveTimeZone } from "./domain.ts";

interface Dependencies {
  readonly history: Pick<HistoryService, "read" | "refresh" | "subscribe">;
  readonly bundle: Pick<DayBundleService, "read">;
  readonly auth: Pick<AuthController, "getSnapshot">;
  readonly current: () => EvidenceIdentity | null;
  readonly now: () => Date;
}
export type CalendarView = ReturnType<typeof buildCalendar> & {
  /** False: activity is hidden (P29 gates); tasks still render while unlocked. */
  readonly isHistoryAvailable: boolean;
  readonly today: string;
  readonly timeZone: string;
  /** Owner + session the view was read for; null = nothing private was read. */
  readonly identityKey: string | null;
};

/** Read-only composition of P29 history and the downloaded tasks; no network, no writes. */
export class CalendarService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  /** The unlocked owner + session; null while locked or signed out. */
  identityKey = (): string | null => {
    const identity = this.#deps.current();
    if (identity === null || this.#deps.auth.getSnapshot().phase !== "unlocked") return null;
    return JSON.stringify([ownerKey(identity.owner), identity.sessionId]);
  };
  async read(): Promise<CalendarView> {
    const key = this.identityKey();
    const { timeZone, epiWeek, today } = this.#organization();
    const [history, cache] = await Promise.all([
      this.#deps.history.read(),
      this.#deps.bundle.read(),
    ]);
    // Same fence as P29: a lock or identity change during the reads shows nothing private.
    const isCurrent = key !== null && this.identityKey() === key;
    const visible = isCurrent
      ? { entries: history.entries, unscoped: history.unscoped, tasks: cache.tasks }
      : { entries: [], unscoped: [], tasks: [] };
    return {
      ...buildCalendar({ ...visible, timeZone, epiWeek, today }),
      isHistoryAvailable: isCurrent && history.available,
      today,
      timeZone,
      identityKey: isCurrent ? key : null,
    };
  }
  #organization() {
    const organization = this.#deps.auth.getSnapshot().profile?.organization;
    const timeZone = resolveTimeZone(organization?.timezone ?? null);
    const today = captureLocalDate(this.#deps.now().toISOString(), timeZone);
    if (today === null) throw new Error("The resolved time zone did not format today.");
    return { timeZone, epiWeek: organization?.epi_week ?? null, today };
  }
  refresh = () => this.#deps.history.refresh();
  /** Auth and bundle (updated, revoked, scope change): the P29 privacy sources. */
  subscribe = (listener: () => void) => this.#deps.history.subscribe(listener);
}
