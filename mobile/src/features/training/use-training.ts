import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useServices } from "../../app/services-context.ts";
import type { TrainingSource } from "./types.ts";
import { nextTrainingBoundary } from "./presentation.ts";
import { TrainingLoader } from "./training-loader.ts";
import type { TrainingLoadState } from "./training-loader.ts";

const MAX_TIMER_DELAY = 2_147_483_647;
function useTrainingClock(source: TrainingSource | null) {
  const { auth } = useServices();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const boundary = nextTrainingBoundary(source, now);
    if (boundary === null) return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
      },
      Math.min(MAX_TIMER_DELAY, Math.max(0, boundary - Date.now())),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [source, now]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => {
      setNow(Date.now());
    });
    return () => {
      subscription.remove();
    };
  }, []);
  return new Date(auth.getSnapshot().hasClockSkew ? Number.NaN : now);
}
function useTrainingSubscription(read: () => Promise<void>, invalidate: () => void) {
  const { training, auth } = useServices();
  useEffect(() => {
    const update = () => {
      void read();
    };
    update();
    const stops = [training.subscribe(update), auth.subscribe(update)];
    return () => {
      invalidate();
      stops.forEach((stop) => {
        stop();
      });
    };
  }, [training, auth, read, invalidate]);
}
function useTrainingRead() {
  const { training } = useServices();
  const [state, setState] = useState<TrainingLoadState>({ source: null, hasLocalError: false });
  const loader = useMemo(
    () => new TrainingLoader({ read: () => training.read(), publish: setState }),
    [training],
  );
  useTrainingSubscription(loader.read, loader.invalidate);
  return { ...state, read: loader.read };
}
export function useTraining() {
  const { training, auth } = useServices();
  const local = useTrainingRead();
  const [isRefreshing, setRefreshing] = useState(false);
  const [hasRefreshError, setRefreshError] = useState(false);
  const busy = useRef(false);
  const refresh = async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    setRefreshError(false);
    try {
      await training.refresh();
    } catch {
      setRefreshError(true);
    } finally {
      await local.read();
      busy.current = false;
      setRefreshing(false);
    }
  };
  return {
    ...local,
    now: useTrainingClock(local.source),
    isRefreshing,
    hasRefreshError,
    refresh,
    timeZone: auth.getSnapshot().profile?.organization?.timezone ?? "UTC",
  };
}
