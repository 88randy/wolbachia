import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { InlineNotice } from "../../ui/InlineNotice";
export function ClosureReceipt({ receipt }: { receipt: Schemas["QuadrantClosure"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <div role="status">
      <InlineNotice tone="success">
        <p>{t("closure.receipt.reference", { reference: receipt.id })}</p>
        <p>
          {t("closure.readiness.version", {
            version: receipt.quadrant_version,
            revision: receipt.revision,
          })}
        </p>
        <p>
          {t("closure.receipt.audit", {
            author: receipt.created_by ?? t("closure.receipt.unknownAuthor"),
            time: format(receipt.closed_at),
          })}
        </p>
      </InlineNotice>
    </div>
  );
}
