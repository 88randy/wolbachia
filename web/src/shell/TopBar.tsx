import { LanguageSwitch } from "./LanguageSwitch";
import { NotificationsSlot } from "./NotificationsSlot";
import { SearchSlot } from "./SearchSlot";
import { UserMenu } from "./UserMenu";
import styles from "./TopBar.module.css";

/**
 * Banner landmark: search, notifications, language and the user menu. The center selector is
 * [PENDING] (`scope.centers` are plain strings and there is no centers endpoint), so its place
 * stays free.
 */
export function TopBar() {
  return (
    <header className={styles.topBar}>
      <SearchSlot />
      <div className={styles.spacer} />
      <NotificationsSlot />
      <LanguageSwitch />
      <UserMenu />
    </header>
  );
}
