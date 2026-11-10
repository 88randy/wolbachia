import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { TransferEvidence } from "./TransferEvidence";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";

export function DiscrepancyReceivingEvidence({
  state,
  line,
}: {
  state: DiscrepancyRecordState;
  line: Schemas["DiscrepancyLine"];
}) {
  const { t } = useTranslation();
  return (
    <>
      <TransferEvidence
        scope={state.scope}
        label={t("discrepancies.close.signature")}
        isBlocked={state.command.isFrozen || !state.isFresh || !state.isOnline}
        onVerified={(signatureId) => {
          state.setSignature(line.id, signatureId);
        }}
      />
      <TransferEvidence
        scope={state.scope}
        label={t("discrepancies.close.photo")}
        isBlocked={state.command.isFrozen || !state.isFresh || !state.isOnline}
        onVerified={state.setEvidence}
      />
    </>
  );
}
