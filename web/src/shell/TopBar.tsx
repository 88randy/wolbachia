import { useMe } from "../session/use-me";
import { initialsOf } from "./user-display";
import { CenterSelector } from "../centers/CenterSelector";
import { LanguageSwitch } from "./LanguageSwitch";
import { NotificationsSlot } from "./NotificationsSlot";
import { SearchSlot } from "./SearchSlot";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./TopBar.module.css";

/** Shell controls, including the backend-scoped center filter (never an authorization grant). */
export function TopBar() {
  const me = useMe();
  return (
    <header className={styles.topBar}>
      <CenterSelector />
      <SearchSlot />
      <div className={styles.spacer} />
      <NotificationsSlot />
      <LanguageSwitch />
      <ThemeSwitch />
      <span className={styles.avatar} aria-hidden="true">
        {initialsOf(me.user)}
      </span>
    </header>
  );
}
