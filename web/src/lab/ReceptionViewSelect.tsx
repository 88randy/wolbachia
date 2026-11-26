import { QuickFilter } from "../data-table/QuickFilter";
import type { SelectFilter } from "../data-table/table-types";
import type { ReceptionView } from "./reception-table";

interface ReceptionViewSelectProps {
  view: ReceptionView;
  canRead: boolean;
  onChange: (value: string) => void;
}

/** The reception views as status tabs (same segmented control as the other lists). */
export function ReceptionViewSelect({ view, canRead, onChange }: ReceptionViewSelectProps) {
  const filter: SelectFilter = {
    kind: "select",
    key: "view",
    labelKey: "labReception.filters.status",
    presentation: "segmented",
    defaultValue: "received",
    options: [
      { value: "received", labelKey: "labReception.table.received" },
      { value: "noPaddle", labelKey: "labReception.table.noPaddle" },
      ...(canRead ? [{ value: "expected", labelKey: "labReception.table.expected" } as const] : []),
      { value: "discrepancies", labelKey: "labReception.table.discrepancies" },
    ],
  };
  return (
    <QuickFilter
      filter={filter}
      value={view}
      onChange={(next) => {
        onChange(next ?? "received");
      }}
    />
  );
}
