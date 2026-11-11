/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative column list. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCenterColumns } from "../data-table/center-column";
import type { DataTableColumn } from "../data-table/table-types";
import { useLanguage } from "../i18n/use-language";
import { ActivityStatusPill } from "./ActivityStatusPill";
import { typeLabel } from "./activity-labels";
import type { CommunityActivity } from "./community-query";

/** Columns of W52. Neighbor names and phones never exist in the record, so none can show. */
export function useActivityColumns(): readonly DataTableColumn<CommunityActivity>[] {
  const { i18n } = useTranslation();
  const { language } = useLanguage();
  const columns = useMemo(
    () => [
      { id: "activity_date", headerKey: "community.column.date", cell: (r) => r.activity_date },
      { id: "code", headerKey: "community.column.code", cell: (r) => r.code },
      {
        id: "type",
        headerKey: "community.column.type",
        cell: (r) => typeLabel(r.type_snapshot, language),
      },
      { id: "zone", headerKey: "community.column.zone", cell: (r) => r.zone_code },
      {
        id: "attendance",
        headerKey: "community.column.attendance",
        align: "end",
        cell: (r) => new Intl.NumberFormat(i18n.language).format(r.attendance),
      },
      { id: "agreements", headerKey: "community.column.agreements", cell: (r) => r.agreements },
      {
        id: "incident",
        headerKey: "community.column.incident",
        cell: (r) => r.incident?.code ?? "",
        link: (r) =>
          r.incident === null
            ? undefined
            : { to: "/incidents/$code", params: { code: r.incident.code } },
      },
      {
        id: "status",
        headerKey: "community.column.status",
        cell: (r) => <ActivityStatusPill isVoided={r.is_voided} />,
      },
    ],
    [i18n.language, language],
  );
  return useCenterColumns(columns, (r) => r.center_id, { after: "code" });
}
