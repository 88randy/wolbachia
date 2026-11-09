import { useTranslation } from "react-i18next";
import { SubmitButton } from "../forms/SubmitButton";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
export function MotorcycleCreateActions({
  isBusy,
  onClose,
}: {
  isBusy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        aria-disabled={isBusy}
        onClick={() => {
          if (!isBusy) onClose();
        }}
      >
        {t("common.actions.cancel")}
      </Button>
      <SubmitButton
        label={t("common.actions.save")}
        busyLabel={t("fleet.create.busy")}
        isBusy={isBusy}
      />
    </DialogFooter>
  );
}
