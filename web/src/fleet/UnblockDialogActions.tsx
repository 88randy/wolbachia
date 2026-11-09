import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import type { UnblockForm } from "./use-unblock-form";

export function UnblockDialogActions({
  form,
  onCancel,
}: {
  form: UnblockForm;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        aria-disabled={form.isBusy}
        data-unblock-cancel
        onClick={onCancel}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button
        type="submit"
        disabled={!form.canSubmit}
        loading={form.isBusy}
        aria-label={form.isBusy ? t("fleet.unblock.busy") : undefined}
      >
        {t("fleet.unblock.confirm")}
      </Button>
    </DialogFooter>
  );
}
