import styles from "./lab.module.css";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useLanguage } from "../i18n/use-language";
import { StatusPill } from "../ui/StatusPill";
import type { DataTableColumn } from "../data-table/table-types";
import type { Count, LabScope } from "./lab-query";
import { nameOrDash } from "../lookups/use-reference-names";
import { EmptyValue } from "../ui/EmptyValue";
import { BagCodeLink } from "./trace/BagCodeLink";
import { CountHistoryActions } from "./CountHistoryActions";
function observationColumns(language: string): DataTableColumn<Count>[] {
  return [
    {
      id: "bag_id",
      headerKey: "lab.history.bag",
      cell: (count) => (count.bag_code ? <BagCodeLink code={count.bag_code} /> : <EmptyValue />),
    },
    {
      id: "value",
      headerKey: "lab.count.value",
      align: "end",
      cell: (count) => (
        <span className={count.voided ? styles.voided : undefined}>
          {new Intl.NumberFormat(language).format(count.value)}
        </span>
      ),
    },
  ];
}
function whoWhenColumns(format: ReturnType<typeof useFormatDateTime>): DataTableColumn<Count>[] {
  return [
    {
      id: "created_by",
      headerKey: "lab.history.author",
      cell: (count) => nameOrDash(count.created_by_name),
    },
    {
      id: "created_at",
      headerKey: "lab.history.time",
      cell: (count) => <time dateTime={count.created_at}>{format(count.created_at)}</time>,
    },
    {
      id: "ordinal",
      headerKey: "lab.history.attempt",
      align: "end",
      cell: (count) => count.ordinal,
    },
  ];
}
export function useHistoryColumns(scope: LabScope, draftKey: string): DataTableColumn<Count>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const { language } = useLanguage();
  return [
    ...observationColumns(language),
    ...whoWhenColumns(format),
    {
      id: "status",
      headerKey: "lab.queue.status",
      cell: (count) => (
        <StatusPill tone={count.voided ? "neutral" : "success"}>
          {t(count.voided ? "lab.history.voided" : "lab.history.recorded")}
        </StatusPill>
      ),
    },
    {
      id: "actions",
      headerKey: "lab.history.actions",
      cell: (count) => <CountHistoryActions count={count} scope={scope} draftKey={draftKey} />,
    },
  ];
}
