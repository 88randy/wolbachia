import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Area } from "../router/areas";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { Tooltip } from "../ui/Tooltip";
import { AREA_ICONS } from "./nav-items";
import styles from "./Sidebar.module.css";
import { useNavCount } from "./use-nav-count";
export function SidebarNavItem({ area, collapsed }: { area: Area; collapsed: boolean }) {
  const { t } = useTranslation();
  const Icon = AREA_ICONS[area.id];
  const count = useNavCount(area.id);
  const label = t(`shell.nav.${area.id}`);
  const link = (
    <Link to={area.path} activeOptions={{ exact: area.path === "/" }} className={styles.item}>
      <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.75} />
      <span className={classNames(styles.label, collapsed && utilities.srOnly)}>{label}</span>
      {count !== undefined && (
        <span className={classNames(styles.count, collapsed && styles.countDot)}>
          <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
          <span className={utilities.srOnly}>
            {t("notifications.inbox.total", { count })}
          </span>
        </span>
      )}
    </Link>
  );
  return <li>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>;
}
