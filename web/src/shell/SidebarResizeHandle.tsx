/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", {"roles": ["separator"]}] -- WAI-ARIA window splitter uses a focusable separator. */
import { web } from "@wolbachia/tokens";
import { useTranslation } from "react-i18next";
import { SIDEBAR_ID } from "./ids";
import { useSidebarPointer } from "./use-sidebar-pointer";
import { useFocusMainOnUnmount } from "./use-focus-main-on-unmount";
import { sidebarKeyboardHandler } from "./sidebar-keyboard";
import styles from "./Sidebar.module.css";
export interface SidebarResizeHandleProps {
  width: number;
  collapsed: boolean;
  onWidth: (next: number) => void;
  onToggle: () => void;
  onReset: () => void;
}
export function SidebarResizeHandle(props: SidebarResizeHandleProps) {
  const { width, collapsed } = props;
  const { t } = useTranslation();
  const { isDragging, ...pointer } = useSidebarPointer(width, props.onWidth);
  const ref = useFocusMainOnUnmount();
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- WAI-ARIA window splitter requires arrow-key resizing on its separator.
    <div
      {...pointer}
      ref={ref}
      className={styles.resizeHandle}
      data-dragging={isDragging}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls={SIDEBAR_ID}
      aria-label={t("refresh.sidebar.resize")}
      aria-valuenow={collapsed ? web.layout.sidebarCollapsedWidth : width}
      aria-valuemin={collapsed ? web.layout.sidebarCollapsedWidth : web.layout.sidebarMinWidth}
      aria-valuemax={web.layout.sidebarMaxWidth}
      onKeyDown={sidebarKeyboardHandler(props)}
      onDoubleClick={props.onReset}
    />
  );
}
