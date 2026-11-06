import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Area } from "../router/areas";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { Tooltip } from "../ui/Tooltip";
import { AREA_ICONS } from "./nav-items";
import styles from "./Sidebar.module.css";
export function SidebarNavItem({ area, collapsed }: { area: Area; collapsed: boolean }) {
  const { t } = useTranslation();
  const Icon = AREA_ICONS[area.id];
  const link = (
    <Link to={area.path} activeOptions={{ exact: area.path === "/" }} className={styles.item}>
      <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.5} />
      <span className={classNames(collapsed && utilities.srOnly)}>{t(`shell.nav.${area.id}`)}</span>
    </Link>
  );
  return (
    <li>{collapsed ? <Tooltip content={t(`shell.nav.${area.id}`)}>{link}</Tooltip> : link}</li>
  );
}
