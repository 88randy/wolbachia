import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { TransferEvidence } from "../transfers/TransferEvidence";
import type { AllocationScope } from "./allocation-query";

/** The RPBI receipt goes through the B-04 upload flow; only a server-verified upload is accepted. */
export function RpbiEvidence({
  scope,
  rpbiUploadId,
  onVerified,
}: {
  scope: AllocationScope;
  rpbiUploadId: string;
  onVerified: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <TransferEvidence
        scope={scope}
        label={t("allocation.writeOff.rpbi")}
        onVerified={onVerified}
      />
      {!rpbiUploadId && (
        <InlineNotice tone="warning">{t("allocation.writeOff.blockerRpbi")}</InlineNotice>
      )}
    </div>
  );
}
