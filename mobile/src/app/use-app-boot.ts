import { useEffect, useState } from "react";

import { createServices } from "./create-services.ts";
import type { AppServices } from "./create-services.ts";
import { loadPreferences } from "./preferences.ts";
import type { Preferences } from "./preferences.ts";

export type BootState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      readonly services: AppServices;
      readonly preferences: Preferences;
    };

async function boot(): Promise<BootState> {
  const services = await createServices();
  const preferences = await loadPreferences(services.kv);
  return { status: "ready", services, preferences };
}

/** Opens the phone's database and loads the saved settings, once. */
export function useAppBoot(): BootState {
  const [state, setState] = useState<BootState>({ status: "loading" });
  useEffect(() => {
    let isCurrent = true;
    boot()
      .then((ready) => {
        if (isCurrent) setState(ready);
      })
      .catch((error: unknown) => {
        console.warn("app.boot_failed", error instanceof Error ? error.name : "unknown");
        if (isCurrent) setState({ status: "failed" });
      });
    return () => {
      isCurrent = false;
    };
  }, []);
  return state;
}
