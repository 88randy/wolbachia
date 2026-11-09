import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSignOut } from "../session/use-sign-out";
import styles from "./UserMenu.module.css";
import { UserMenuButton } from "./UserMenuButton";
import { UserMenuPanel } from "./UserMenuPanel";
import { useDismiss } from "./use-dismiss";

/** Keep disclosure focus and sign-out failure recovery independent of its placement. */
function useUserMenuDisclosure() {
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
  return { isOpen, setIsOpen, containerRef, buttonRef, signOut };
}

/** One user disclosure in the top bar, available with either sidebar state. */
export function UserMenu() {
  const panelId = useId();
  const { isOpen, setIsOpen, containerRef, buttonRef, signOut } = useUserMenuDisclosure();
  return (
    <div ref={containerRef} className={styles.menu}>
      <UserMenuButton
        ref={buttonRef}
        isOpen={isOpen}
        panelId={panelId}
        onToggle={() => {
          setIsOpen((open) => !open);
        }}
      />
      {isOpen && <UserMenuPanel id={panelId} signOut={signOut} />}
    </div>
  );
}
