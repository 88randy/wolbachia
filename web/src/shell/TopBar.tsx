import { CenterSelector } from "../centers/CenterSelector";
import { LanguageSwitch } from "./LanguageSwitch";
import { NotificationsSlot } from "./NotificationsSlot";
import { SearchSlot } from "./SearchSlot";
import { ThemeSwitch } from "./ThemeSwitch";
import { UserMenu } from "./UserMenu";
import styles from "./TopBar.module.css";

/** Shell controls, including the backend-scoped center filter (never an authorization grant). */
export function TopBar() {
  return (
    <header className={styles.topBar}>
      <CenterSelector />
      <SearchSlot />
      <div className={styles.spacer} />
      <NotificationsSlot />
      <LanguageSwitch />
      <ThemeSwitch />
      <UserMenu />
    </header>
  );
}
