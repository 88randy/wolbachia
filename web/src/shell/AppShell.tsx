import { Outlet } from "@tanstack/react-router";
import { SessionExpiredDialog } from "../session/SessionExpiredDialog";
import { useMembershipLost } from "../session/use-membership-lost";
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
  useMembershipLost();
  return (
    <div className={styles.shell}>
      <SkipLink />
      <OfflineBanner />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} onToggle={toggle} canToggle={!isCompact} />
        <div className={styles.column}>
          <TopBar />
          <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <SessionExpiredDialog />
    </div>
  );
}
