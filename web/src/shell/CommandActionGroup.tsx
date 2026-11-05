import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import type { CommandAction } from "./command-actions";

export function CommandActionGroup({
  actions,
  onClose,
}: {
  actions: readonly CommandAction[];
  onClose: (isNavigation?: boolean) => void;
}) {
  const { t } = useTranslation();
  if (actions.length === 0) return null;
  return (
    <Command.Group heading={t("refresh.commands.actions")}>
      {actions.map((action) => (
        <Command.Item
          key={action.id}
          onSelect={() => {
            onClose();
            action.onSelect();
          }}
        >
          {action.label}
        </Command.Item>
      ))}
    </Command.Group>
  );
}
