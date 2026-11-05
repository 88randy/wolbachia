import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { classNames } from "../styles/class-names";
import styles from "./UserMenu.module.css";
import { displayNameOf, initialsOf } from "./user-display";

interface UserMenuButtonProps {
  isOpen: boolean;
  panelId: string;
  onToggle: () => void;
  collapsed?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Hiding the visible name keeps it in the accessible name of the icon rail. */
export function UserMenuButton(props: UserMenuButtonProps) {
  const { isOpen, panelId, onToggle, collapsed = false, ref } = props;
  const { t } = useTranslation();
  const { user } = useMe();
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
      title={collapsed ? displayNameOf(user) : undefined}
    >
      <span className={styles.avatar} aria-hidden="true">
        {initialsOf(user)}
      </span>
      <span className={classNames(styles.buttonName, collapsed && styles.hiddenLabel)}>
        {displayNameOf(user)}
      </span>{" "}
      <span className={styles.hiddenLabel}>{t("shell.userMenu.button")}</span>
      <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={1.5} />
    </button>
  );
}
