import { useLayoutEffect, useRef } from "react";
import { web } from "@wolbachia/tokens";
import { clampSidebarWidth } from "./sidebar-size";
import { useSidebarPreferences } from "./use-sidebar-preferences";
/** Compact mode changes appearance only: it never overwrites the desktop preference. */
export function useResizableSidebar(isCompact: boolean) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { width, setWidth, isCollapsed, setCollapsed } = useSidebarPreferences();
  const collapsed = isCompact || isCollapsed;
  useLayoutEffect(() => {
    frameRef.current?.style.setProperty(
      "--sidebar-current-width",
      `${String(collapsed ? web.layout.sidebarCollapsedWidth : width)}px`,
    );
  }, [width, collapsed]);
  const resize = (next: number) => {
    setWidth(clampSidebarWidth(next));
    setCollapsed(false);
  };
  return {
    frameRef,
    width,
    collapsed,
    resize,
    toggle: () => {
      setCollapsed((previous) => !previous);
    },
    reset: () => {
      resize(web.layout.sidebarWidth);
    },
  };
}
