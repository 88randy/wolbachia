import { useRef, useState } from "react";

import type { LoginNotice } from "./login-error.ts";

/** Synchronous busy guard prevents two taps in one render from starting two native operations. */
export function useAuthAction() {
  const busy = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<LoginNotice | null>(null);
  const run = (operation: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    void operation()
      .catch(() => {
        setError({ key: "mobile.storage.actionFailed" });
      })
      .finally(() => {
        busy.current = false;
        setIsBusy(false);
      });
  };
  return { isBusy, error, setError, run };
}
