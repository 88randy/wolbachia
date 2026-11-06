import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { canOpenShellOverlay } from "./modal-exclusion";
import { isShellSessionAvailable, subscribeToShellSession } from "./shell-session";
type ShellOverlay = "palette" | "help";
/** One modal slot, discarded whenever the page loses its usable session. */
export function useShellOverlay() {
  const [overlay, setOverlay] = useState<ShellOverlay | null>(null);
  const isAvailable = useSyncExternalStore(subscribeToShellSession, isShellSessionAvailable);
  useEffect(
    () =>
      subscribeToShellSession(() => {
        if (!isShellSessionAvailable()) setOverlay(null);
      }),
    [],
  );
  const open = useCallback((next: ShellOverlay) => {
    if (!canOpenShellOverlay()) return false;
    setOverlay(next);
    return true;
  }, []);
  const setOpen = useCallback(
    (kind: ShellOverlay, shouldOpen: boolean) => {
      if (shouldOpen) open(kind);
      else setOverlay((current) => (current === kind ? null : current));
    },
    [open],
  );
  return { overlay: isAvailable ? overlay : null, open, setOpen };
}
