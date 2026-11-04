import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { classNames } from "../styles/class-names";
import { SIDEBAR_ID } from "./ids";
import { visibleNavGroups } from "./nav-items";
import styles from "./Sidebar.module.css";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarToggle } from "./SidebarToggle";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** False on small screens, where the sidebar is always collapsed. */
  canToggle: boolean;
}

/** Left navigation: the areas the user may open, grouped, with a collapse button. */
export function Sidebar({ collapsed, onToggle, canToggle }: SidebarProps) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <div id={SIDEBAR_ID} className={classNames(styles.sidebar, collapsed && styles.collapsed)}>
      <SidebarBrand collapsed={collapsed} />
      <nav className={styles.nav} aria-label={t("shell.nav.label")}>
        {visibleNavGroups(me).map((group) => (
          <SidebarGroup key={group.id} group={group} collapsed={collapsed} />
        ))}
      </nav>
      {canToggle ? <SidebarToggle collapsed={collapsed} onToggle={onToggle} /> : null}
    </div>
  );
}
