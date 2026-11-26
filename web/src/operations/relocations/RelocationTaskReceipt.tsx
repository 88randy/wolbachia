import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { InlineNotice } from "../../ui/InlineNotice";
export function RelocationTaskReceipt({
  receipt,
}: {
  receipt: Schemas["RelocationDecisionResult"];
}) {
  const { t } = useTranslation();
  return (
    <>
      {receipt.next_day_task ? (
        <p>
          {t("relocations.workspace.task")} {receipt.next_day_task.code} ·{" "}
          {receipt.next_day_task.due_date}
        </p>
      ) : (
        <p>{t("relocations.workspace.noTask")}</p>
      )}
      {receipt.warnings.map((_warning, index) => (
        <InlineNotice key={index} tone="warning">
          {t("relocations.workspace.advisory")}
        </InlineNotice>
      ))}
    </>
  );
}
