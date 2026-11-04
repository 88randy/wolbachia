import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import { SIDEBAR_ID } from "./ids";
import { NAV_GROUPS } from "./nav-items";
import styles from "./Sidebar.module.css";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarToggle } from "./SidebarToggle";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Left navigation: the areas of the back-office, grouped, with a collapse button. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  return (
    <div id={SIDEBAR_ID} className={classNames(styles.sidebar, collapsed && styles.collapsed)}>
      <SidebarBrand collapsed={collapsed} />
      <nav className={styles.nav} aria-label={t("shell.nav.label")}>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.id} group={group} collapsed={collapsed} />
        ))}
      </nav>
      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </div>
  );
}
