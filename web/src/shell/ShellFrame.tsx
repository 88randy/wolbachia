import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSessionExpired } from "../session/use-session-expired";
import { useVisibleSessionState } from "../session/use-visible-session-state";
import { SessionBlocker } from "../states/SessionBlocker";
import { SessionExpiredDialog } from "../session/SessionExpiredDialog";
import { useSessionChanges } from "../session/use-session-changes";
import styles from "./AppShell.module.css";
import { MAIN_ID } from "./ids";
import { OfflineBanner } from "./OfflineBanner";
import { RefreshIndicator } from "./RefreshIndicator";
import { ShellSidebar } from "./ShellSidebar";
import { SkipLink } from "./SkipLink";
import { Breadcrumbs } from "./Breadcrumbs";
import { TopBar } from "./TopBar";
import { useCompactViewport } from "../ui/use-compact-viewport";
import { useFocusMainOnNavigation } from "./use-focus-main-on-navigation";
import { useResizableSidebar } from "./use-resizable-sidebar";

export function ShellFrame({ children }: { children?: ReactNode }) {
  const isCompact = useCompactViewport();
  const sidebar = useResizableSidebar(isCompact);
  useFocusMainOnNavigation();
  useSessionChanges();
  const state = useVisibleSessionState();
  const isExpired = useSessionExpired();
  return (
    <div className={styles.shell}>
      <SkipLink />
      <OfflineBanner />
      <div ref={sidebar.frameRef} className={styles.body}>
        <ShellSidebar sidebar={sidebar} isCompact={isCompact} />
        <div className={styles.column}>
          <TopBar />
          <main id={MAIN_ID} className={styles.main} tabIndex={-1} inert={state !== "known"}>
            <RefreshIndicator />
            <Breadcrumbs />
            {children ?? <Outlet />}
          </main>
          {state !== "known" && !isExpired && <SessionBlocker key={state} state={state} />}
        </div>
      </div>
      <SessionExpiredDialog />
    </div>
  );
}
