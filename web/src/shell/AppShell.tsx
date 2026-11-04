import { Outlet } from "@tanstack/react-router";
import styles from "./AppShell.module.css";
import { MAIN_ID } from "./ids";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";
import { useFocusMainOnNavigation } from "./use-focus-main-on-navigation";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

/** Frame of every page: skip link, sidebar, top bar and the main landmark with the route. */
export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapsed();
  useFocusMainOnNavigation();
  return (
    <div className={styles.shell}>
      <SkipLink />
      <OfflineBanner />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className={styles.column}>
          <TopBar />
          <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
