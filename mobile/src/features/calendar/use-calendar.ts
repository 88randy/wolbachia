import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import { CalendarReads } from "./calendar-reads.ts";

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
  return {
    ...state,
    retry: () => reads.load(),
    refresh: () => reads.load(calendar.refresh),
  };
}
