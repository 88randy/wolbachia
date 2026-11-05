import { web } from "@wolbachia/tokens";
import type { KeyboardEvent } from "react";
import { stepSidebarWidth } from "./sidebar-size";
import type { SidebarResizeHandleProps } from "./SidebarResizeHandle";
function widthForKey(width: number, key: string): number | undefined {
  const widths: Partial<Record<string, number>> = {
    ArrowLeft: stepSidebarWidth(width, -1),
    ArrowRight: stepSidebarWidth(width, 1),
    Home: web.layout.sidebarMinWidth,
    End: web.layout.sidebarMaxWidth,
  };
  return widths[key];
}
/** Ignore unrelated keys so the separator never traps keyboard navigation. */
export function sidebarKeyboardHandler(props: SidebarResizeHandleProps) {
  return (event: KeyboardEvent) => {
    const next = widthForKey(props.width, event.key);
    if (next !== undefined) {
      event.preventDefault();
      props.onWidth(next);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    props.onToggle();
  };
}
