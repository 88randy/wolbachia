import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Area } from "../router/areas";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { AREA_ICONS } from "./nav-items";
import styles from "./Sidebar.module.css";

interface SidebarNavItemProps {
  area: Area;
  collapsed: boolean;
}

/** One area link. The label stays in the accessibility tree when the sidebar is collapsed. */
export function SidebarNavItem({ area, collapsed }: SidebarNavItemProps) {
  const { t } = useTranslation();
  const Icon = AREA_ICONS[area.id];
  return (
    <li>
      <Link to={area.path} activeOptions={{ exact: area.path === "/" }} className={styles.item}>
        <Icon aria-hidden="true" className={styles.icon} />
        <span className={classNames(collapsed && utilities.srOnly)}>
          {t(`shell.nav.${area.id}`)}
        </span>
      </Link>
    </li>
  );
}
