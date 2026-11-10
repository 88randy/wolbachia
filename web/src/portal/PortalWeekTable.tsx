/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WeekRow } from "./portal-data";
import { usePortalFormat } from "./use-portal-format";

/** The equivalent of the chart: the same numbers, week by week. */
export function PortalWeekTable({ weeks }: { weeks: readonly WeekRow[] }) {
  const { t } = useTranslation();
  const format = usePortalFormat();
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-line">
      <Table aria-label={t("portal.trends.tableTitle")}>
        <TableHeader className="sticky top-0 bg-surface-muted">
          <TableRow>
            <TableHead scope="col">{t("portal.trends.week")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("portal.trends.releases")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("portal.trends.quantity")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.map((week) => (
            <TableRow key={week.weekStart}>
              <TableCell>{format.date(week.weekStart)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(week.releases)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(week.quantity)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
