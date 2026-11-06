import { useTranslation } from "react-i18next";
import { SEARCH_INPUT_ID } from "./ids";
import styles from "./TopBar.module.css";
import { useOpenCommandPalette } from "./command-context";
import { useSearchTrigger } from "./use-search-trigger";
export function SearchTriggerInput() {
  const { t } = useTranslation();
  const open = useOpenCommandPalette();
  const onKeyDown = useSearchTrigger();
  return (
    <input
      id={SEARCH_INPUT_ID}
      className={styles.input}
      type="search"
      readOnly
      aria-label={t("shell.topBar.searchLabel")}
      aria-keyshortcuts="Control+K Meta+K"
      aria-haspopup="dialog"
      placeholder={t("shell.topBar.searchPlaceholder")}
      onClick={open}
      onKeyDown={onKeyDown}
    />
  );
}
