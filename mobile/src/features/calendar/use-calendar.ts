import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { CalendarReads, isStaleDay } from "./calendar-reads.ts";

/** How often an open calendar checks whether the organization's date changed (midnight). */
const DAY_CHECK_MS = 60_000;

/** Re-reads when the app returns to the foreground or the local date changes. */
function useTodayRefresh(reads: CalendarReads) {
  useEffect(() => {
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void reads.load();
    });
    const timer = setInterval(() => {
      if (isStaleDay(reads.getSnapshot().view, new Date())) void reads.load();
    }, DAY_CHECK_MS);
    return () => {
      foreground.remove();
      clearInterval(timer);
    };
  }, [reads]);
}

/**
 * P33 data on the P29 sources: auth/bundle changes hide the view before re-reading; sync
 * results re-read stale-while-revalidate (same identity only, see `CalendarReads`).
 */
export function useCalendar() {
  const { calendar, engine } = useServices();
  const reads = useMemo(() => new CalendarReads(calendar), [calendar]);
  const state = useSyncExternalStore(reads.subscribe, reads.getSnapshot);
  useEffect(() => {
    const onPrivacyChange = () => {
      reads.hide();
      void reads.load();
    };
    const onSync = () => {
      void reads.load();
    };
    void reads.load();
    const stops = [calendar.subscribe(onPrivacyChange), engine.subscribe(onSync)];
    return () => {
      reads.stop();
      stops.forEach((stop) => {
        stop();
      });
    };
  }, [calendar, engine, reads]);
  useTodayRefresh(reads);
  return {
    ...state,
    retry: () => reads.load(),
    refresh: () => reads.load(calendar.refresh),
  };
}
