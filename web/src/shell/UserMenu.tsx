import { useCallback, useEffect, useRef, useState } from "react";
import { useSignOut } from "../session/use-sign-out";
import styles from "./UserMenu.module.css";
import { UserMenuButton } from "./UserMenuButton";
import { UserMenuPanel } from "./UserMenuPanel";
import { useDismiss } from "./use-dismiss";

const PANEL_ID = "user-menu-panel";

/**
 * The signed-in user in the top bar. A disclosure (not an ARIA menu): the button reports
 * `aria-expanded`, Escape closes it and returns focus to the button, and so do an outside press
 * and moving focus out of it. The sign-out state lives here, not in the panel: signing out blocks
 * the page while the server answers (focus moves to the blocker and closes the panel), and a
 * failure must still be shown, so the menu opens again for it.
 */
export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dismiss = useCallback((viaEscape: boolean) => {
    setIsOpen(false);
    if (viaEscape) buttonRef.current?.focus();
  }, []);
  useDismiss({ isOpen, containerRef, onDismiss: dismiss });
  const signOut = useSignOut();
  const hasFailed = signOut.failure !== undefined;
  useEffect(() => {
    if (hasFailed) setIsOpen(true);
  }, [hasFailed]);
  return (
    <div ref={containerRef} className={styles.menu}>
      <UserMenuButton
        ref={buttonRef}
        isOpen={isOpen}
        panelId={PANEL_ID}
        onToggle={() => {
          setIsOpen((open) => !open);
        }}
      />
      {isOpen && <UserMenuPanel id={PANEL_ID} signOut={signOut} />}
    </div>
  );
}
