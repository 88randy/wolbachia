import { useTranslation } from "react-i18next";
import { SubmitButton } from "../forms/SubmitButton";
import { Button } from "../ui/Button";
import { FormActions } from "../components/templates/FormGrid";
export function MotorcycleCreateActions({
  isBusy,
  onClose,
}: {
  isBusy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FormActions>
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
    </FormActions>
  );
}
