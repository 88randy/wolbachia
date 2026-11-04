import { Search } from "lucide-react";
import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { SEARCH_INPUT_ID } from "./ids";
import styles from "./TopBar.module.css";
import { searchShortcutHint, useSearchShortcut } from "./use-search-shortcut";

/**
 * Place of the universal search (W3). It has no backend yet: it only holds the slot, the
 * label and the Ctrl+K / Cmd+K shortcut so the layout and keyboard flow are final.
 */
export function SearchSlot() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef);
  function ignoreSubmit(event: SyntheticEvent) {
    event.preventDefault();
  }
  return (
    <form
      className={styles.search}
      role="search"
      aria-label={t("shell.topBar.searchLabel")}
      onSubmit={ignoreSubmit}
    >
      <Search aria-hidden="true" className={styles.icon} />
      <input
        ref={inputRef}
        id={SEARCH_INPUT_ID}
        className={styles.input}
        type="search"
        aria-label={t("shell.topBar.searchLabel")}
        aria-keyshortcuts="Control+K Meta+K"
        placeholder={t("shell.topBar.searchPlaceholder")}
      />
      <kbd className={styles.shortcut} aria-hidden="true">
        {searchShortcutHint(navigator.platform)}
      </kbd>
    </form>
  );
}
