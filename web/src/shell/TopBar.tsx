import { LanguageSwitch } from "./LanguageSwitch";
import { NotificationsSlot } from "./NotificationsSlot";
import { SearchSlot } from "./SearchSlot";
import styles from "./TopBar.module.css";

/**
 * Banner landmark. The center selector (left) and the user menu (right) come with the session
 * in #28, so their places are simply free here.
 */
export function TopBar() {
  return (
    <header className={styles.topBar}>
      <SearchSlot />
      <div className={styles.spacer} />
      <NotificationsSlot />
      <LanguageSwitch />
    </header>
  );
}
