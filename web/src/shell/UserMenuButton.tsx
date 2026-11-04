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

/**
 * Avatar and name. The visible text is hidden from assistive technology because the accessible
 * name is set once, and it contains the visible name (WCAG 2.5.3 label in name).
 */
export function UserMenuButton({ isOpen, panelId, onToggle, ref }: UserMenuButtonProps) {
  const { t } = useTranslation();
  const { user } = useMe();
  const name = displayNameOf(user);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      aria-expanded={isOpen}
      aria-controls={panelId}
      aria-label={`${name}, ${t("shell.userMenu.button")}`}
      onClick={onToggle}
    >
      <span className={styles.avatar} aria-hidden="true">
        {initialsOf(user)}
      </span>
      <span className={styles.buttonName} aria-hidden="true">
        {name}
      </span>
      <ChevronDown aria-hidden="true" className={styles.chevron} />
    </button>
  );
}
