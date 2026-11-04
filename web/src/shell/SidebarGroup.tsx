import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import utilities from "../styles/utilities.module.css";
import type { NavGroup } from "./nav-items";
import styles from "./Sidebar.module.css";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarGroupProps {
  group: NavGroup;
  collapsed: boolean;
}

/** A heading (when the group has one) and its list of links. */
export function SidebarGroup({ group, collapsed }: SidebarGroupProps) {
  const { t } = useTranslation();
  const headingId = `nav-group-${group.id}`;
  return (
    <div className={styles.group}>
      {group.headingKey ? (
        <p
          id={headingId}
          className={classNames(collapsed ? utilities.srOnly : styles.groupHeading)}
        >
          {t(group.headingKey)}
        </p>
      ) : null}
      <ul className={styles.list} aria-labelledby={group.headingKey ? headingId : undefined}>
        {group.areas.map((area) => (
          <SidebarNavItem key={area.id} area={area} collapsed={collapsed} />
        ))}
      </ul>
    </div>
  );
}
