import { useTranslation } from "react-i18next";
import { ReceptionMissingTrigger } from "./ReceptionMissingTrigger";
import { Dialog } from "../ui/Dialog";
import type { ReceptionActions } from "./use-reception-command";
import type { ReceptionRow } from "./reception-query";
import { useMissingReception } from "./use-missing-reception";
import { ReceptionMissingForm } from "./ReceptionMissingForm";
export function ReceptionMissingDialog({
  row,
  actions,
  isReady,
}: {
  row: ReceptionRow;
  actions: ReceptionActions;
  isReady: boolean;
}) {
  const { t } = useTranslation();
  const form = useMissingReception({ row, actions, isReady });
  return (
    <Dialog
      open={form.isOpen}
      onOpenChange={form.onOpenChange}
      title={`${t("labReception.action.markMissing")} · ${row.code ?? ""}`}
      description={t("labReception.action.missingHint")}
      trigger={<ReceptionMissingTrigger isReady={isReady} />}
    >
      <ReceptionMissingForm id={row.id} form={form} actions={actions} />
    </Dialog>
  );
}
