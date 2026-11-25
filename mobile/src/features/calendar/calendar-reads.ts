import { captureLocalDate } from "../day/capture-local-date.ts";
import type { CalendarService, CalendarView } from "./service.ts";

/** True once `now` falls on another local date than the view's `today` (#373 step 10). */
export function isStaleDay(view: CalendarView | null, now: Date): boolean {
  return view !== null && captureLocalDate(now.toISOString(), view.timeZone) !== view.today;
}

export interface CalendarReadState {
  readonly view: CalendarView | null;
  readonly hasError: boolean;
}

/**
 * The P33 read guard, outside React so it is tested deterministically. Latest read wins;
 * `hide` drops private rows at once (auth/bundle/scope change); a failed read keeps the last
 * view only when it belongs to the identity that is still current.
 */
export class CalendarReads {
  readonly #calendar: Pick<CalendarService, "read" | "identityKey">;
  readonly #listeners = new Set<() => void>();
  #sequence = 0;
  #state: CalendarReadState = { view: null, hasError: false };
  constructor(calendar: Pick<CalendarService, "read" | "identityKey">) {
    this.#calendar = calendar;
  }
  getSnapshot = (): CalendarReadState => this.#state;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  hide = (): void => {
    this.#sequence++;
    this.#set({ view: null, hasError: false });
  };
  /** Supersedes pending reads (unmount). */
  stop = (): void => {
    this.#sequence++;
  };
  /** `before` (e.g. a server refresh) failing counts as a failed read. */
  load = async (before?: () => Promise<unknown>): Promise<void> => {
    const request = ++this.#sequence;
    const key = this.#calendar.identityKey();
    try {
      if (before) await before();
      const view = await this.#calendar.read();
      if (request === this.#sequence) this.#set({ view, hasError: false });
    } catch {
      if (request !== this.#sequence) return;
      const { view } = this.#state;
      const isSameIdentity =
        view !== null && view.identityKey === key && this.#calendar.identityKey() === key;
      this.#set({ view: isSameIdentity ? view : null, hasError: true });
    }
  };
  #set(state: CalendarReadState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
}
