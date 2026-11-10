import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import type { ReceptionActions } from "./use-reception-command";
import type { MissingReceptionForm } from "./use-missing-reception";

export function ReceptionMissingFooter({
  form,
  actions,
}: {
  form: MissingReceptionForm;
  actions: ReceptionActions;
}) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        onClick={() => {
          form.onOpenChange(false);
        }}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button
        type="submit"
        loading={actions.isBusy}
        aria-disabled={!form.reason.trim() || !form.isReady || actions.isReviewRequired}
      >
        {t("labReception.action.confirmMissing")}
      </Button>
    </DialogFooter>
  );
}
