import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { ReceptionView } from "./reception-table";

interface ReceptionViewSelectProps {
  view: ReceptionView;
  canRead: boolean;
  onChange: (value: string) => void;
}
export function ReceptionViewSelect({ view, canRead, onChange }: ReceptionViewSelectProps) {
  const { t } = useTranslation();
  const options = [
    { value: "received", label: t("labReception.table.received") },
    { value: "noPaddle", label: t("labReception.table.noPaddle") },
    ...(canRead ? [{ value: "expected", label: t("labReception.table.expected") }] : []),
    { value: "discrepancies", label: t("labReception.table.discrepancies") },
  ];
  return (
    <Select
      id="reception-view"
      label={t("labReception.filters.status")}
      value={view}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      options={options}
    />
  );
}
