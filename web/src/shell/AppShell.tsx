import { Outlet } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { isSessionUnknown, subscribeToRevision } from "../session/session-revision";
import { SessionCheckFailed } from "../states/SessionCheckFailed";
import { SessionExpiredDialog } from "../session/SessionExpiredDialog";
import { useCrossTabSession } from "../session/use-cross-tab-session";
import { useSessionChanges } from "../session/use-session-changes";
import styles from "./AppShell.module.css";
import { MAIN_ID } from "./ids";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";
import { useCompactViewport } from "./use-compact-viewport";
import { useFocusMainOnNavigation } from "./use-focus-main-on-navigation";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

/** Frame of every page: skip link, sidebar, top bar and the main landmark with the route. */
export function AppShell() {
  const { collapsed: preferCollapsed, toggle } = useSidebarCollapsed();
  const isCompact = useCompactViewport();
  const collapsed = isCompact || preferCollapsed;
  useFocusMainOnNavigation();
  useSessionChanges();
  useCrossTabSession();
  const isUnknown = useSyncExternalStore(subscribeToRevision, isSessionUnknown);
  return (
    <div className={styles.shell}>
      <SkipLink />
      <OfflineBanner />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} onToggle={toggle} canToggle={!isCompact} />
        <div className={styles.column}>
          <TopBar />
          <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
            {isUnknown ? <SessionCheckFailed /> : <Outlet />}
          </main>
        </div>
      </div>
      <SessionExpiredDialog />
    </div>
  );
}
