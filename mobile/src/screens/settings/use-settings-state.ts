import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import type { SettingsState, SettingsService } from "./settings-service.ts";

function loadSettings(
  settings: SettingsService,
  publish: (state: SettingsState | null, hasError: boolean) => void,
) {
  let isCurrent = true;
  void settings
    .read()
    .then((state) => {
      if (isCurrent) publish(state, false);
    })
    .catch(() => {
      if (isCurrent) publish(null, true);
    });
  return () => {
    isCurrent = false;
  };
}

export function useSettingsState() {
  const { settings, auth, engine } = useServices();
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const sync = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [state, setState] = useState<SettingsState | null>(null);
  const [hasError, setHasError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    return loadSettings(settings, (next, failed) => {
      setState(next);
      setHasError(failed);
    });
  }, [settings, session, sync, revision]);
  const lock = useCallback(() => {
    void settings.lock().catch(() => {
      setHasError(true);
    });
  }, [settings]);
  return {
    state,
    hasError,
    lock,
    retry: () => {
      setRevision((value) => value + 1);
    },
  };
}
