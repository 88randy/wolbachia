import { useCan } from "../session/use-can";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { CorrectCountTrigger } from "./CorrectCountTrigger";
import { CorrectionDialogBody } from "./CorrectionDialogBody";
import type { Count, LabScope } from "./lab-query";
interface CorrectCountDialogProps {
  scope: LabScope;
  count: Count;
  draftKey: string;
}
/** The server atomically appends the void and replacement; the original count is retained. */
export function CorrectCountDialog({ scope, count, draftKey }: CorrectCountDialogProps) {
  const { t } = useTranslation();
  const canReadReasons = useCan()("catalog.read");
  const [isOpen, setOpen] = useState(false);
  const [isBusy, setBusy] = useState(false);
  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isBusy && canReadReasons) setOpen(open);
        }}
        title={t("lab.correction.title")}
        description={t("lab.correction.hint")}
        trigger={<CorrectCountTrigger canReadReasons={canReadReasons} />}
      >
        <CorrectionDialogBody
          isOpen={isOpen}
          scope={scope}
          count={count}
          storageKey={draftKey + ":correction:" + count.id}
          onBusyChange={setBusy}
          onOpenChange={setOpen}
        />
      </Dialog>
      {!canReadReasons && <p>{t("lab.correction.catalogPermission")}</p>}
    </>
  );
}
