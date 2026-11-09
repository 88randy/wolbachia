import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import styles from "./UserMenu.module.css";
import { displayNameOf, initialsOf } from "./user-display";

interface UserMenuButtonProps {
  isOpen: boolean;
  panelId: string;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** The single top-bar user menu keeps its visible name in the accessible name. */
export function UserMenuButton(props: UserMenuButtonProps) {
  const { isOpen, panelId, onToggle, ref } = props;
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
    >
      <span className={styles.avatar} aria-hidden="true">
        {initialsOf(user)}
      </span>
      <span className={styles.buttonName}>{displayNameOf(user)}</span>{" "}
      <span className={styles.hiddenLabel}>{t("shell.userMenu.button")}</span>
      <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={1.5} />
    </button>
  );
}
