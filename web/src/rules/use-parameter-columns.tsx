import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDate, useFormatNumber } from "../format/use-formatters";
import { NotConfiguredBadge } from "./NotConfiguredBadge";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";

type Column = DataTableColumn<RuleParameter>;

/** What the cells write: names and units, numbers, and dates ("None" when there is no date). */
interface Writers {
  name: (key: string) => string;
  unit: (unit: string) => string;
  number: (value: number) => string;
  dateOrNone: (iso: string | null) => string;
}

/** The page of the parameter: its history and the form for a new version. */
function pageOf(parameter: RuleParameter) {
  return { to: "/settings/rule-parameters/$key", params: { key: parameter.key } } as const;
}

function identityColumns(write: Writers): Column[] {
  return [
    {
      id: "name",
      headerKey: "rules.column.parameter",
      cell: (parameter) => write.name(parameter.key),
      link: pageOf,
    },
    {
      id: "key",
      headerKey: "rules.column.key",
      cell: (parameter) => <code className={styles.code}>{parameter.key}</code>,
    },
    { id: "unit", headerKey: "rules.column.unit", cell: (p) => write.unit(p.unit) },
  ];
}

function valueColumns(write: Writers): Column[] {
  return [
    {
      id: "value",
      headerKey: "rules.column.value",
      align: "end",
      link: pageOf,
      cell: ({ value }) => (value === null ? <NotConfiguredBadge /> : write.number(value)),
    },
    {
      id: "effective_from",
      headerKey: "rules.column.since",
      cell: (p) => write.dateOrNone(p.effective_from),
    },
    {
      id: "next",
      headerKey: "rules.column.next",
      cell: (p) => write.dateOrNone(p.next_change_at),
    },
  ];
}

/**
 * Columns of the parameter list (W62): the name (a link to the parameter), its key, unit, the
 * value in force (also a link: the records behind the number are its history), since when, and
 * the next scheduled change. A parameter with no version is shown as not configured, never as 0.
 */
export function useParameterColumns(): readonly Column[] {
  const { t } = useTranslation();
  const labels = useParameterLabels();
  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();
  return useMemo(() => {
    const write: Writers = {
      name: labels.name,
      unit: labels.unit,
      number: formatNumber,
      dateOrNone: (iso) => (iso === null ? t("rules.cell.none") : formatDate(iso)),
    };
    return [...identityColumns(write), ...valueColumns(write)];
  }, [t, labels, formatNumber, formatDate]);
}
