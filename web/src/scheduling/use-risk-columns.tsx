import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { StatusPill } from "../ui/StatusPill";

type Risk = Schemas["Risk"];
const TONE = { high: "critical", medium: "warning", low: "success" } as const;

export function useRiskColumns(): readonly DataTableColumn<Risk>[] {
  const { t } = useTranslation();
  return [
    { id: "block__code", headerKey: "scheduling.risk.block", cell: (row) => row.code },
    {
      id: "category",
      headerKey: "scheduling.risk.category",
      cell: (row) => (
        <StatusPill tone={TONE[row.category]}>{t(`scheduling.risk.${row.category}`)}</StatusPill>
      ),
    },
    {
      id: "source",
      headerKey: "scheduling.risk.origin",
      cell: (row) =>
        row.source === "official_import"
          ? t("scheduling.risk.sourceOfficial")
          : t("scheduling.risk.sourceCompany"),
    },
    { id: "protocol", headerKey: "scheduling.risk.protocol", cell: (row) => row.protocol || "—" },
  ];
}
