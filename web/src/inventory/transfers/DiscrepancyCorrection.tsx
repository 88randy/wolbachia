import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";
import { useDiscrepancyCorrection } from "./discrepancy-use-correction";
import { DiscrepancyCorrectionSearch } from "./DiscrepancyCorrectionSearch";
import { DiscrepancyCorrectionReceipt } from "./DiscrepancyCorrectionReceipt";

interface CorrectionProps {
  state: DiscrepancyRecordState;
  line: Schemas["DiscrepancyLine"];
}
export function DiscrepancyCorrection({ state, line }: CorrectionProps) {
  const { t } = useTranslation();
  const model = useDiscrepancyCorrection(state, line);
  return (
    <section>
      <DiscrepancyCorrectionSearch model={model} />
      <DiscrepancyCorrectionReceipt model={model} />
      <p>{t("discrepancies.correction.requirements")}</p>
    </section>
  );
}
