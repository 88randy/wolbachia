import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { MAIN_ID, SIDEBAR_ID } from "./ids";
import styles from "./Sidebar.module.css";

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Collapses the sidebar to icons and back. */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const { t } = useTranslation();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The button disappears when the viewport becomes compact. If it had focus, keep keyboard
  // users in the page instead of dropping focus to <body>.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    return () => {
      if (document.activeElement === button) document.getElementById(MAIN_ID)?.focus();
    };
  }, []);
  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.toggle}
      aria-pressed={collapsed}
      aria-controls={SIDEBAR_ID}
      onClick={onToggle}
    >
      <Icon aria-hidden="true" className={styles.icon} />
      <span className={classNames(collapsed && utilities.srOnly)}>
        {t("shell.sidebar.collapse")}
      </span>
    </button>
  );
}
