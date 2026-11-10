import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { useLocale } from "../../i18n/I18nProvider.tsx";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { filterHistory, groupHistory } from "./domain.ts";
import type { HistoryView, HistoryGroup, HistoryEntry } from "./domain.ts";
import type { HistoryService } from "./service.ts";

function useLocalHistory(history: HistoryService) {
  const [view, setView] = useState<HistoryView | null>(null);
  const [hasError, setError] = useState(false);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  const read = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const next = await history.read();
      if (request === sequence.current) setView(next);
    } catch {
      if (request === sequence.current) {
        setView(null);
        setError(true);
      }
    }
  }, [history]);
  return { view, setView, hasError, setError, invalidate, read };
}
type LocalState = ReturnType<typeof useLocalHistory>;
function useSubscriptions(history: HistoryService, engine: SyncEngine, state: LocalState) {
  const { setView, read, invalidate } = state;
  useEffect(() => {
    const update = () => {
      setView(null);
      void read();
    };
    update();
    const stops = [history.subscribe(update), engine.subscribe(update)];
    return () => {
      invalidate();
      stops.forEach((stop) => {
        stop();
      });
    };
  }, [history, engine, read, setView, invalidate]);
}
function useHistoryRows(view: HistoryView | null, search: string) {
  const { auth } = useServices(),
    locale = useLocale();
  const timezone = auth.getSnapshot().profile?.organization?.timezone ?? "UTC";
  const [selected, selectGroup] = useState<string | null>(null);
  const groups = groupHistory(filterHistory(view?.entries ?? [], search), timezone);
  const selectedGroup = groups.find((group) => group.id === selected);
  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const rows: readonly (HistoryGroup | HistoryEntry)[] = selectedGroup?.entries ?? groups;
  const formatTime = (time: string | null) =>
    time && Number.isFinite(Date.parse(time)) ? timeFormat.format(new Date(time)) : null;
  return {
    rows,
    selectGroup,
    isSelected: selectedGroup !== undefined,
    formatTime,
    backToGroups: () => {
      selectGroup(null);
    },
  };
}
/** Subscription invalidation hides private rows synchronously before an asynchronous local read. */
export function useHistory() {
  const { history, engine } = useServices();
  const state = useLocalHistory(history);
  const [search, setSearch] = useState("");
  useSubscriptions(history, engine, state);
  const refresh = async () => {
    state.setError(false);
    try {
      await history.refresh();
      await state.read();
    } catch {
      state.setError(true);
    }
  };
  return { ...state, ...useHistoryRows(state.view, search), search, setSearch, refresh };
}
