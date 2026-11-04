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
 * Avatar and name. The accessible name is the visible name plus a hidden "User menu" (so it
 * contains what is on screen, WCAG 2.5.3); the initials are decoration. On narrow screens the
 * name is visually hidden, not removed, so the name stays the same.
 */
export function UserMenuButton({ isOpen, panelId, onToggle, ref }: UserMenuButtonProps) {
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
      <ChevronDown aria-hidden="true" className={styles.chevron} />
    </button>
  );
}
