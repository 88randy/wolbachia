import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useCouriers } from "../scheduling/use-directories";
import { StatusPill } from "../ui/StatusPill";
export function useShiftColumns(): readonly DataTableColumn<Schemas["Shift"]>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const courierName = useCouriers([]).nameOf;
  return [
    {
      id: "code",
      headerKey: "shift.field.code",
      cell: (shift) => shift.code,
      link: (shift) => ({ to: "/operations/shifts/$code", params: { code: shift.code } }),
    },
    {
      id: "opened_at_device",
      headerKey: "shift.field.opened",
      cell: (shift) => format(shift.opened_at_device),
    },
    {
      id: "motorcycle",
      headerKey: "shift.field.motorcycle",
      cell: (shift) => shift.motorcycle_code,
    },
    {
      id: "courier",
      headerKey: "shift.field.courier",
      cell: (shift) => courierName(shift.courier),
    },
    {
      id: "status",
      headerKey: "shift.field.lifecycle",
      cell: (shift) => (
        <StatusPill tone={shift.status === "closed" ? "neutral" : "info"}>
          {t(shift.status === "closed" ? "shift.status.closed" : "shift.status.open")}
        </StatusPill>
      ),
    },
  ];
}
