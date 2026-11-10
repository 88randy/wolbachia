/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TableState } from "../../data-table/table-types";
import { useFormatCalendarDate, useFormatNumber } from "../../format/use-formatters";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { receiptOptions } from "../reg-queries";
import { useRegScope } from "../use-reg-list";

const FIRST_PAGE: TableState = {
  page: 1,
  cursor: null,
  sort: null,
  isSortExplicit: false,
  filters: {},
  includeVoided: false,
};

/** The latest downloads: who, what and which period. Never the rows themselves. */
export function ExportHistory() {
  const { t } = useTranslation();
  const scope = useRegScope();
  const formatDateTime = useFormatDateTime();
  const formatDay = useFormatCalendarDate();
  const formatNumber = useFormatNumber();
  const query = useQuery({
    ...receiptOptions(scope, FIRST_PAGE),
    enabled: scope.identity.isSettled,
  });
  const rows = (query.data?.results ?? []).slice(0, 5);
  return (
    <Card title={t("regulatory.exports.history")} headingLevel={2}>
      {rows.length === 0 ? (
        <EmptyState kind="noData" message={t("regulatory.exports.historyEmpty")} />
      ) : (
        <Table aria-label={t("regulatory.exports.history")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("regulatory.access.col.when")}</TableHead>
              <TableHead>{t("regulatory.access.col.who")}</TableHead>
              <TableHead>{t("regulatory.access.col.dataset")}</TableHead>
              <TableHead>{t("regulatory.access.col.period")}</TableHead>
              <TableHead className="text-right">{t("regulatory.access.col.rows")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDateTime(row.created_at)}</TableCell>
                <TableCell>{row.actor_name ?? t("regulatory.access.system")}</TableCell>
                <TableCell>
                  {t(`regulatory.exports.dataset.${row.dataset as "releases"}`)}
                </TableCell>
                <TableCell>{`${formatDay(row.date_from)} – ${formatDay(row.date_to)}`}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.row_count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
