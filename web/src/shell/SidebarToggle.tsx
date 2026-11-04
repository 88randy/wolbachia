import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { SIDEBAR_ID } from "./ids";
import styles from "./Sidebar.module.css";

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Collapses the sidebar to icons and back. */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const { t } = useTranslation();
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
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
