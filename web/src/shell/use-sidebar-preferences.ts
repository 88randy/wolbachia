import { useEffect, useState } from "react";
import { readStored, STORAGE_KEYS, writeStored } from "../storage/safe-storage";
import { parseSidebarWidth } from "./sidebar-size";
/** Invalid storage normalizes on first mount; compact layout never writes a preference. */
export function useSidebarPreferences() {
  const [width, setWidth] = useState(() =>
    parseSidebarWidth(readStored(STORAGE_KEYS.sidebarWidth)),
  );
  const [isCollapsed, setCollapsed] = useState(
    () => readStored(STORAGE_KEYS.sidebarCollapsed) === "true",
  );
  useEffect(() => {
    writeStored(STORAGE_KEYS.sidebarWidth, String(width));
  }, [width]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.sidebarCollapsed, String(isCollapsed));
  }, [isCollapsed]);
  return { width, setWidth, isCollapsed, setCollapsed };
}
