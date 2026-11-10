import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
interface ConfirmationProps {
  action: "close" | "void";
  isEnabled: boolean;
  isBusy: boolean;
  onConfirm: () => void;
}
export function IncidentActionConfirmation({
  action,
  isEnabled,
  isBusy,
  onConfirm,
}: ConfirmationProps) {
  const { t } = useTranslation();
  const label = t(`incidents.workspace.${action}`);
  return (
    <ConfirmDialog
      title={label}
      consequence={t(`incidents.workspace.${action}Consequence`)}
      actionLabel={label}
      trigger={
        <Button
          variant={action === "void" ? "secondary" : "primary"}
          aria-disabled={!isEnabled}
          loading={isBusy}
        >
          {label}
        </Button>
      }
      onConfirm={onConfirm}
    />
  );
}
