import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useMe } from "../../session/use-me";
import { displayNameOf } from "../../shell/user-display";
import { TransferEvidence } from "./TransferEvidence";
import { TransferSignature } from "./TransferSignature";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";

export function DiscrepancyReceivingEvidence({
  state,
  line,
}: {
  state: DiscrepancyRecordState;
  line: Schemas["DiscrepancyLine"];
}) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <>
      <TransferSignature
        id={`signature-${line.id}`}
        scope={state.scope}
        signerName={displayNameOf(me.user)}
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
