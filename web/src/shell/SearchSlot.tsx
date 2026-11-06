import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./TopBar.module.css";
import { searchShortcutHint } from "./use-search-shortcut";
import { useOpenCommandPalette } from "./command-context";
import { SearchTriggerInput } from "./SearchTriggerInput";
export function SearchSlot() {
  const { t } = useTranslation();
  const open = useOpenCommandPalette();
  return (
    <form
      className={styles.search}
      role="search"
      aria-label={t("shell.topBar.searchLabel")}
      onSubmit={(event) => {
        event.preventDefault();
        open();
      }}
    >
      <Search aria-hidden="true" strokeWidth={1.5} className={styles.icon} />
      <SearchTriggerInput />
      <kbd className={styles.shortcut} aria-hidden="true">
        {searchShortcutHint(navigator.platform)}
      </kbd>
    </form>
  );
}
