import type { AuthController } from "../../auth/auth-controller.ts";
import { captureLocalDate } from "../day/capture-local-date.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { HistoryService } from "../history/service.ts";
import { buildCalendar, resolveTimeZone } from "./domain.ts";

interface Dependencies {
  readonly history: Pick<HistoryService, "read" | "refresh" | "subscribe">;
  readonly bundle: Pick<DayBundleService, "read">;
  readonly auth: Pick<AuthController, "getSnapshot">;
  readonly now: () => Date;
}
export type CalendarView = ReturnType<typeof buildCalendar> & {
  /** False: activity is hidden (P29 gates); tasks still render. */
  readonly isHistoryAvailable: boolean;
  readonly today: string;
  readonly timeZone: string;
};

/** Read-only composition of P29 history and the downloaded tasks; no network, no writes. */
export class CalendarService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async read(): Promise<CalendarView> {
    const organization = this.#deps.auth.getSnapshot().profile?.organization;
    const timeZone = resolveTimeZone(organization?.timezone ?? null);
    const today = captureLocalDate(this.#deps.now().toISOString(), timeZone);
    if (today === null) throw new Error("The resolved time zone did not format today.");
    const [history, cache] = await Promise.all([
      this.#deps.history.read(),
      this.#deps.bundle.read(),
    ]);
    const calendar = buildCalendar({
      entries: history.entries,
      unscoped: history.unscoped,
      tasks: cache.tasks,
      timeZone,
      epiWeek: organization?.epi_week ?? null,
      today,
    });
    return { ...calendar, isHistoryAvailable: history.available, today, timeZone };
  }
  refresh = () => this.#deps.history.refresh();
  /** Same sources as P29 (auth + bundle); the hook adds the sync engine like `use-history`. */
  subscribe = (listener: () => void) => this.#deps.history.subscribe(listener);
}
