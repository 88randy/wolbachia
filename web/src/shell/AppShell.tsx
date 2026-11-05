import { Outlet } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useSessionExpired } from "../session/use-session-expired";
import { sessionState, subscribeToRevision } from "../session/session-revision";
import { SessionBlocker } from "../states/SessionBlocker";
import { SessionExpiredDialog } from "../session/SessionExpiredDialog";
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
  const state = useSyncExternalStore(subscribeToRevision, sessionState);
  const isExpired = useSessionExpired();
  return (
    <div className={styles.shell}>
      <SkipLink />
      <OfflineBanner />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} onToggle={toggle} canToggle={!isCompact} />
        <div className={styles.column}>
          <TopBar />
          {/* Org-scoped content only in `known`: the screens stay mounted (drafts are kept) but inert. */}
          <main id={MAIN_ID} className={styles.main} tabIndex={-1} inert={state !== "known"}>
            <Outlet />
          </main>
          {state !== "known" && !isExpired && <SessionBlocker key={state} state={state} />}
        </div>
      </div>
      <SessionExpiredDialog />
    </div>
  );
}
