import type { LocationState } from "./location.ts";
import { refreshDay } from "./refresh-day.ts";
import type { MessageKey } from "@wolbachia/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { buildDay } from "./domain.ts";
import type { AssignedTask } from "./types.ts";
import type { DaySnapshot } from "./service.ts";
import { useDayLocation } from "./use-day-location.ts";
import { useDayRefresh } from "./use-day-refresh.ts";
function useDaySnapshot() {
  const { day, engine } = useServices();
  const [state, setState] = useState<DaySnapshot | null>(null);
  const sequence = useRef(0);
  const [errorKey, setError] = useState<MessageKey | null>(null);
  const read = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const snapshot = await day.read();
      if (current === sequence.current) setState(snapshot);
    } catch {
      if (current === sequence.current) setError("mobile.storage.actionFailed");
    }
  }, [day]);
  useEffect(() => {
    void read();
    const stop = engine.subscribe(() => {
      void read();
    });
    return () => {
      sequence.current += 1;
      stop();
    };
  }, [engine, read]);
  return { day, state, read, errorKey, setError };
}
function useDayActions(snapshot: ReturnType<typeof useDaySnapshot>) {
  const { day, read, setError } = snapshot;
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await read();
      } catch {
        setError("mobile.storage.actionFailed");
      }
    },
    [read, setError],
  );
  const refresh = useCallback(async () => {
    setError(null);
    try {
      await refreshDay(day, read);
    } catch {
      setError("mobile.day.refreshFailed");
    }
  }, [day, read, setError]);
  const select = (task: AssignedTask) => run(() => day.select(task.id));
  const navigate = (task: AssignedTask) => run(() => day.navigate(task.id));
  const clearSelection = () => run(() => day.clearSelection());
  const retryMap = () => run(() => day.verifyMap(true));
  return { refresh, select, navigate, retryMap, clearSelection };
}
/** Cached snapshot is published before bootstrap; network failures never block list/point selection. */
export function useM06() {
  const snapshot = useDaySnapshot();
  const actions = useDayActions(snapshot);
  const location = useDayLocation(snapshot.day.location, snapshot.state?.isShiftOpen ?? false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useDayRefresh(actions.refresh, snapshot.state?.meta?.next_change_at ?? null);
  const day = deriveDay(snapshot.state, location, now);

  return { ...snapshot, ...actions, ...day, now };
}
export type M06Model = ReturnType<typeof useM06>;

function deriveDay(state: DaySnapshot | null, location: LocationState, now: Date) {
  const day = buildDay({ tasks: state?.tasks ?? [], work: state?.work ?? [], location, now });
  const selected = day.tasks.find((row) => row.task.id === state?.navigation?.pointId) ?? null;
  return { ...day, selected };
}
