import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
interface Props {
  isBusy: boolean;
  onCancel: () => void;
  confirmKey: MessageKey;
  onConfirm?: () => void;
}
/** Native dialog callbacks and submit behavior stay owned by the existing form. */
export function CatalogDialogActions({ isBusy, onCancel, confirmKey, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Button variant="secondary" disabled={isBusy} onClick={onCancel}>
        {t("common.actions.cancel")}
      </Button>
      <Button
        type={onConfirm ? "button" : "submit"}
        disabled={isBusy}
        loading={isBusy}
        aria-label={isBusy ? t("catalogs.form.busy") : undefined}
        onClick={onConfirm}
      >
        {t(confirmKey)}
      </Button>
    </DialogFooter>
  );
}
