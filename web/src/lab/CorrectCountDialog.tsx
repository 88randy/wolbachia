import { useCan } from "../session/use-can";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { CorrectionContext } from "./CorrectionContext";
import type { Count, LabScope } from "./lab-query";
/** The server atomically appends the void and replacement; the original count is retained. */
export function CorrectCountDialog({ scope, count, draftKey }: { scope: LabScope; count: Count; draftKey: string }) {
  const { t } = useTranslation();
  const canReadReasons = useCan()("catalog.read");
  const [isOpen, setOpen] = useState(false);
  const [isBusy, setBusy] = useState(false);
  return <><Dialog open={isOpen} onOpenChange={(open) => { if (!isBusy && canReadReasons) setOpen(open); }} title={t("lab.correction.title")} description={t("lab.correction.hint")}
    trigger={<Button variant="secondary" aria-disabled={!canReadReasons} title={!canReadReasons ? t("lab.correction.catalogPermission") : undefined}>{t("lab.correction.title")}</Button>}>
    {isOpen && <CorrectionContext onBusyChange={setBusy} scope={scope} count={count} storageKey={draftKey + ":correction:" + count.id} onClose={() => { setBusy(false); setOpen(false); }} />}
  </Dialog>{!canReadReasons && <p>{t("lab.correction.catalogPermission")}</p>}</>;
}
