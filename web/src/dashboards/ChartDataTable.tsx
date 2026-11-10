import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Dashboard } from "./dashboard-query";
import type { Granularity } from "./dashboard-filters";
import { useDashboardText } from "./use-dashboard-text";

type ChartTable = Dashboard["charts"][number]["table"];

interface ChartDataTableProps {
  table: ChartTable;
  title: string;
  granularity: Granularity;
}

/** The equivalent of the chart as a table, behind a disclosure so the page stays light. */
export function ChartDataTable({ table, title, granularity }: ChartDataTableProps) {
  const { t } = useTranslation();
  const text = useDashboardText();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-action hover:bg-tint"
      >
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
        />
        {t(isOpen ? "analytics.chart.hideTable" : "analytics.chart.showTable")}
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        className="mt-2 max-h-96 overflow-auto rounded-xl border border-line"
      >
        {isOpen && (
          <Table aria-label={t("analytics.chart.tableCaption", { title })}>
            <TableHeader className="sticky top-0 bg-surface-muted">
              <TableRow>
                {table.columns.map((column, index) => (
                  <TableHead
                    key={column.key}
                    scope="col"
                    className={cn("text-xs font-semibold text-ink-2", index > 0 && "text-right")}
                  >
                    {text.label(column.label)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {table.columns.map((column, index) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "text-[13px] text-ink",
                        typeof row[column.key] === "number" && "text-right tabular-nums",
                        index > 0 && typeof row[column.key] !== "number" && "text-right",
                      )}
                    >
                      {text.cell(column.key, row[column.key], granularity)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
