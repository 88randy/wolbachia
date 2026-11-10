import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { MAIN_ID } from "../shell/ids";
export function ShiftCommandItem({ onClose }: { onClose: (isNavigation?: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  if (!can("shift.read")) return null;
  return (
    <Command.Group heading={t("shift.page.title")}>
      <Command.Item
        value={t("shift.page.title")}
        onSelect={() => {
          onClose(true);
          void navigate({ to: "/operations/shifts", search: { status: "closed" } }).then(() => {
            document.getElementById(MAIN_ID)?.focus();
          });
        }}
      >
        {t("shift.page.title")}
      </Command.Item>
    </Command.Group>
  );
}
