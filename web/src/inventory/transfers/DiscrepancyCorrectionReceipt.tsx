import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { DiscrepancyCorrectionModel } from "./discrepancy-use-correction";

export function DiscrepancyCorrectionReceipt({ model }: { model: DiscrepancyCorrectionModel }) {
  const { t } = useTranslation();
  const id = useId();
  const format = useFormatDateTime();
  const options = [
    { value: "", label: t("discrepancies.outcome.choose") },
    ...model.receipts.map((event) => ({
      value: event.id,
      label: format(event.server_received_at),
    })),
  ];
  return (
    <Select
      id={id}
      label={t("discrepancies.correction.receipt")}
      value={model.selectedReceipt}
      options={options}
      onChange={(event) => {
        model.selectReceipt(event.currentTarget.value);
      }}
    />
  );
}
