import { useState } from "react";
import { classNames } from "../styles/class-names";
import type { NavGroup } from "./nav-items";
import styles from "./Sidebar.module.css";
import { SidebarGroupHeading } from "./SidebarGroupHeading";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarGroupProps {
  group: NavGroup;
  collapsed: boolean;
}

/** Named groups retain visible icon links when the full navigation is collapsed. */
export function SidebarGroup({ group, collapsed }: SidebarGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const headingId = `nav-group-${group.id}`;
  const listId = `${headingId}-items`;
  return (
    <div className={styles.group}>
      <SidebarGroupHeading
        headingId={headingId}
        listId={listId}
        headingKey={group.headingKey}
        collapsed={collapsed}
        isExpanded={isExpanded}
        onToggle={() => {
          setIsExpanded((open) => !open);
        }}
      />
      <ul
        id={listId}
        className={classNames(styles.list, group.headingKey && !collapsed && styles.tree)}
        aria-labelledby={group.headingKey ? headingId : undefined}
        hidden={!collapsed && !isExpanded}
      >
        {group.areas.map((area) => (
          <SidebarNavItem key={area.id} area={area} collapsed={collapsed} />
        ))}
      </ul>
    </div>
  );
}
