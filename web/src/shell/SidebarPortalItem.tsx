import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { can } from "../session/can";
import { useMe } from "../session/use-me";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import { Tooltip } from "../ui/Tooltip";
import styles from "./Sidebar.module.css";

/**
 * "Portal público": the read-only portal of the organization, for who holds `portal.read` (the
 * government profile's only screen). Its path carries the organization slug, so it is not one of
 * the static areas.
 */
export function SidebarPortalItem({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const orgSlug = me.organization?.slug;
  if (orgSlug === undefined || !can(me, "portal.read")) return null;
  const label = t("shell.nav.portal");
  const link = (
    <Link to="/portal/$orgSlug" params={{ orgSlug }} className={styles.item}>
      <Globe aria-hidden="true" className={styles.icon} strokeWidth={1.75} />
      <span className={classNames(styles.label, collapsed && utilities.srOnly)}>{label}</span>
    </Link>
  );
  return (
    <div className={styles.group}>
      <ul className={styles.list}>
        <li>{collapsed ? <Tooltip content={label}>{link}</Tooltip> : link}</li>
      </ul>
    </div>
  );
}
