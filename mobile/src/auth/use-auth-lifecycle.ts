import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState, Keyboard } from "react-native";

import { useServices } from "../app/services-context.ts";
import { IdleLock } from "./idle-lock.ts";

export function useAuthLifecycle() {
  const { auth } = useServices();
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const [isWarning, setIsWarning] = useState(false);
  const idle = useIdleLock(auth, setIsWarning);
  useAuthSignals(idle);
  useEffect(() => {
    if (snapshot.phase === "unlocked") idle.start(snapshot.rules.sessionIdleMinutes);
    else {
      idle.stop();
      // Remote session end must also blur a covered form, without unmounting or clearing it.
      Keyboard.dismiss();
    }
    return () => {
      idle.stop();
    };
  }, [idle, snapshot.phase, snapshot.rules.sessionIdleMinutes]);
  return {
    snapshot,
    isWarning,
    touch: () => {
      idle.touch();
    },
  };
}

function useAuthSignals(idle: IdleLock): void {
  useEffect(() => {
    const app = AppState.addEventListener("change", (state) => {
      if (state === "background") idle.background();
    });
    return () => {
      app.remove();
    };
  }, [idle]);
}

function useIdleLock(
  auth: ReturnType<typeof useServices>["auth"],
  setIsWarning: (value: boolean) => void,
) {
  return useMemo(
    () =>
      new IdleLock({
        warn: setIsWarning,
        lock: () => {
          Keyboard.dismiss();
          void auth.lock();
        },
        schedule: (callback, delay) => {
          const handle = setTimeout(callback, delay);
          return () => {
            clearTimeout(handle);
          };
        },
      }),
    [auth, setIsWarning],
  );
}
