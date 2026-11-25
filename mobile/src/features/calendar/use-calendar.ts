import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import type { CalendarService, CalendarView } from "./service.ts";

/** Latest-read-wins: an older read finishing late never replaces a newer one. */
function useCalendarRead(calendar: CalendarService) {
  const [view, setView] = useState<CalendarView | null>(null);
  const [hasError, setError] = useState(false);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const read = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const next = await calendar.read();
      if (request !== sequence.current) return;
      setView(next);
      setError(false);
    } catch {
      // Stale-while-revalidate: the last good grid stays under the inline error.
      if (request === sequence.current) setError(true);
    }
  }, [calendar]);
  return { view, setView, hasError, setError, invalidate, read };
}

/** P33 data: re-reads on the same sources as P29 (auth, bundle, sync engine). */
export function useCalendar() {
  const { calendar, engine, auth } = useServices();
  const state = useCalendarRead(calendar);
  const { setView, read, invalidate } = state;
  useEffect(() => {
    const update = () => {
      // A lock or session end hides private rows at once, before the asynchronous read.
      if (auth.getSnapshot().phase !== "unlocked") setView(null);
      void read();
    };
    update();
    const stops = [calendar.subscribe(update), engine.subscribe(update)];
    return () => {
      invalidate();
      stops.forEach((stop) => {
        stop();
      });
    };
  }, [calendar, engine, auth, read, setView, invalidate]);
  const refresh = async () => {
    try {
      await calendar.refresh();
      await read();
    } catch {
      state.setError(true);
    }
  };
  return { view: state.view, hasError: state.hasError, retry: read, refresh };
}
