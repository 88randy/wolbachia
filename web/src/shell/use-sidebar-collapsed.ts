import { useCallback, useState } from "react";
import { readStored, STORAGE_KEYS, writeStored } from "../storage/safe-storage";

/** Collapsed (64 px, icons only) or expanded sidebar, remembered per browser. */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(
    () => readStored(STORAGE_KEYS.sidebarCollapsed) === "true",
  );
  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    writeStored(STORAGE_KEYS.sidebarCollapsed, String(next));
  }, [collapsed]);
  return { collapsed, toggle };
}
