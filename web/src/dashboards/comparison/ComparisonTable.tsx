/* eslint-disable max-lines-per-function -- presentational JSX of a table; splitting it into one-use fragments would hurt readability. */
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatNumber } from "../../format/use-formatters";
import { rowName } from "./comparison-format";
import type { Comparison, ComparisonRow, Indicator } from "./comparison-query";

interface ComparisonTableProps {
  comparison: Comparison;
  indicator: Indicator;
}

/** The chart as a table: counts, result and the change from the previous period, never color alone. */
export function ComparisonTable({ comparison, indicator }: ComparisonTableProps) {
  const { t } = useTranslation();
  const format = useFormatNumber();
  const byQuadrant = comparison.group_by === "quadrant";
  const isPercent = comparison.unit === "percent";
  const value = (row: ComparisonRow) =>
    row.value === null
      ? t("comparison.noValue")
      : t(isPercent ? "comparison.value.percent" : "comparison.value.eggs", {
          value: format(row.value),
        });
  const change = (row: ComparisonRow) => {
    if (row.delta === null)
      return <span className="text-ink-2">{t("comparison.change.none")}</span>;
    const amount = t(isPercent ? "comparison.change.points" : "comparison.change.eggs", {
      value: format(Math.abs(row.delta)),
    });
    // For these indicators a higher figure is not "good" or "bad" by itself, so direction is
    // shown with an arrow and words, in a neutral tone.
    if (row.delta === 0) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Equal aria-hidden="true" className="size-3.5" />
          {t("comparison.change.same")}
        </span>
      );
    }
    const Icon = row.delta > 0 ? ArrowUp : ArrowDown;
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5" />
        {t(row.delta > 0 ? "comparison.change.up" : "comparison.change.down", { value: amount })}
      </span>
    );
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <Table aria-label={t("comparison.title")}>
        <TableHeader className="bg-surface-muted">
          <TableRow>
            <TableHead scope="col">
              {t(byQuadrant ? "comparison.col.quadrant" : "comparison.col.center")}
            </TableHead>
            {byQuadrant && <TableHead scope="col">{t("comparison.col.center")}</TableHead>}
            <TableHead scope="col" className="text-right">
              {t(`comparison.col.den.${indicator}`)}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t(`comparison.col.num.${indicator}`)}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("comparison.col.value")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("comparison.col.change")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-ink">
                {byQuadrant ? row.quadrant_code : rowName(row)}
              </TableCell>
              {byQuadrant && <TableCell>{row.center_name}</TableCell>}
              <TableCell className="text-right tabular-nums">{format(row.denominator)}</TableCell>
              <TableCell className="text-right tabular-nums">{format(row.numerator)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{value(row)}</TableCell>
              <TableCell className="text-right tabular-nums">{change(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
