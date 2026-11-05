import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSignOut } from "../session/use-sign-out";
import styles from "./UserMenu.module.css";
import { UserMenuButton } from "./UserMenuButton";
import { UserMenuPanel } from "./UserMenuPanel";
import { useDismiss } from "./use-dismiss";

interface UserMenuProps {
  placement?: "topbar" | "sidebar";
  collapsed?: boolean;
}

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

/** User disclosure anchored above the sidebar footer or below a top-bar trigger. */
export function UserMenu({ placement = "topbar", collapsed = false }: UserMenuProps = {}) {
  const panelId = useId();
  const { isOpen, setIsOpen, containerRef, buttonRef, signOut } = useUserMenuDisclosure();
  return (
    <div
      ref={containerRef}
      className={styles.menu}
      data-placement={placement}
      data-collapsed={collapsed}
    >
      <UserMenuButton
        ref={buttonRef}
        isOpen={isOpen}
        panelId={panelId}
        collapsed={collapsed}
        onToggle={() => {
          setIsOpen((open) => !open);
        }}
      />
      {isOpen && <UserMenuPanel id={panelId} signOut={signOut} />}
    </div>
  );
}
