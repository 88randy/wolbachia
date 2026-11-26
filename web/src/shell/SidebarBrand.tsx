import styles from "./Sidebar.module.css";
import { useOrganizationLogo } from "./use-organization-logo";
import { Wordmark } from "./Wordmark";

/** Product wordmark, with the organization's own logo when it has one. */
export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const logo = useOrganizationLogo();
  return (
    <div className={styles.brand}>
      <Wordmark compact={collapsed} logo={logo} />
    </div>
  );
}
