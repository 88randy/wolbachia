import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import type { CommandAction } from "./command-actions";
import { CommandItems } from "./CommandItems";
import styles from "./commands.module.css";

interface CommandSearchProps {
  actions: readonly CommandAction[];
  onClose: (isNavigation?: boolean) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
}
export function CommandSearch({ actions, onClose, query, onQueryChange }: CommandSearchProps) {
  const { t } = useTranslation();
  return (
    <Command label={t("shell.topBar.searchLabel")}>
      <Command.Input
        className={styles.input}
        placeholder={t("shell.topBar.searchPlaceholder")}
        aria-label={t("shell.topBar.searchLabel")}
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandItems actions={actions} onClose={onClose} />
    </Command>
  );
}
