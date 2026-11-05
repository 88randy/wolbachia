import type { MessageKey } from "@wolbachia/i18n";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import utilities from "../styles/utilities.module.css";
import styles from "./Sidebar.module.css";

interface SidebarGroupHeadingProps {
  headingId: string;
  listId: string;
  headingKey: MessageKey | undefined;
  collapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

/** A stable accessible name for the list, with disclosure only outside the icon rail. */
export function SidebarGroupHeading(props: SidebarGroupHeadingProps) {
  const { headingId, listId, headingKey, collapsed, isExpanded, onToggle } = props;
  const { t } = useTranslation();
  if (!headingKey) return null;
  if (collapsed)
    return (
      <p id={headingId} className={utilities.srOnly}>
        {t(headingKey)}
      </p>
    );
  return (
    <p id={headingId} className={styles.groupHeading}>
      <button
        type="button"
        className={styles.groupToggle}
        aria-expanded={isExpanded}
        aria-controls={listId}
        onClick={onToggle}
      >
        {t(headingKey)}
        <ChevronDown className={styles.chevron} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </p>
  );
}
