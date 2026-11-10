import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { SubmitButton } from "../../forms/SubmitButton";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/DialogFooter";

interface Props {
  isBusy: boolean;
  onClose: () => void;
  labels: { submit: MessageKey; busy: MessageKey };
}

/** Cancel and submit of a permit dialog: a pending submit keeps its width and refuses a repeat. */
export function PermitFormActions({ isBusy, onClose, labels }: Props) {
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
      <SubmitButton label={t(labels.submit)} busyLabel={t(labels.busy)} isBusy={isBusy} />
    </DialogFooter>
  );
}
