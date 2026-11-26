import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { nameOrDash } from "../../lookups/use-reference-names";
import { InlineNotice } from "../../ui/InlineNotice";
import { RelocationTaskReceipt } from "./RelocationTaskReceipt";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { MessageKey } from "@wolbachia/i18n";
export function RelocationReceipt({ receipt }: { receipt: Schemas["RelocationDecisionResult"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <section role="status" aria-live="polite">
      <InlineNotice tone="success">{t("relocations.workspace.saved")}</InlineNotice>
      <dl>
        {receiptFields(receipt, format).map(([label, value]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <RelocationTaskReceipt receipt={receipt} />
    </section>
  );
}

function receiptFields(
  receipt: Schemas["RelocationDecisionResult"],
  format: (iso: string) => string,
): [MessageKey, string | null][] {
  return [
    ["relocations.workspace.decisionReason", receipt.decision.reason],
    ["relocations.workspace.author", nameOrDash(receipt.decision.created_by_name)],
    [
      "relocations.workspace.decidedAt",
      receipt.decision.decided_at ? format(receipt.decision.decided_at) : null,
    ],
  ];
}
