import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { NavGroup } from "./nav-items";
import { MAIN_ID } from "./ids";

interface CommandNavigationGroupProps {
  group: NavGroup;
  onClose: (isNavigation?: boolean) => void;
}
export function CommandNavigationGroup({ group, onClose }: CommandNavigationGroupProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Command.Group
      heading={group.headingKey ? t(group.headingKey) : t("refresh.commands.navigation")}
    >
      {group.areas.map((area) => (
        <Command.Item
          key={area.id}
          value={t(`shell.nav.${area.id}`)}
          onSelect={() => {
            onClose(true);
            void navigate({ to: area.path }).then(() => {
              document.getElementById(MAIN_ID)?.focus();
            });
          }}
        >
          {t(`shell.nav.${area.id}`)}
        </Command.Item>
      ))}
    </Command.Group>
  );
}
