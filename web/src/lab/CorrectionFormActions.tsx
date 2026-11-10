import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import type { useCorrectionForm } from "./use-correction-form";

interface CorrectionFormActionsProps {
  form: ReturnType<typeof useCorrectionForm>;
  onCancel: () => void;
}

export function CorrectionFormActions({ form, onCancel }: CorrectionFormActionsProps) {
  const { t } = useTranslation();
  const kind = form.write.failure?.kind;
  const label =
    kind === "confirm"
      ? "lab.count.confirm"
      : kind === "uncertain"
        ? "lab.count.retry"
        : "lab.correction.save";
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        data-lab-cancel
        aria-disabled={form.write.isBusy || kind === "uncertain"}
        onClick={onCancel}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button type="submit" loading={form.write.isBusy} aria-disabled={kind === "conflict"}>
        {t(label)}
      </Button>
    </DialogFooter>
  );
}
