import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { visibleNavGroups } from "./nav-items";
import type { CommandAction } from "./command-actions";
import { CommandNavigationGroup } from "./CommandNavigationGroup";
import { CommandActionGroup } from "./CommandActionGroup";
import styles from "./commands.module.css";

export function CommandItems({
  actions,
  onClose,
}: {
  actions: readonly CommandAction[];
  onClose: (isNavigation?: boolean) => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <Command.List className={styles.list} label={t("refresh.commands.title")}>
      <Command.Empty>{t("refresh.commands.empty")}</Command.Empty>
      {visibleNavGroups(me).map((group) => (
        <CommandNavigationGroup key={group.id} group={group} onClose={onClose} />
      ))}
      <CommandActionGroup actions={actions} onClose={onClose} />
    </Command.List>
  );
}
