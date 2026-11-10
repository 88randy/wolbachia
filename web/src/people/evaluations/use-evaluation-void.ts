import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { nameOrDash } from "../../lookups/use-reference-names";
import type { Evaluation } from "./evaluation-query";
import type { VoidInfo } from "../../data-table/table-types";
/** Existing void facts use the shared badge, struck-through row and retained reason/author. */
export function useEvaluationVoid(): (row: Evaluation) => VoidInfo | null {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (row) =>
    row.void
      ? {
          reason: `${row.void.reason_code}: ${row.void.reason}`,
          author: `${t("evaluations.history.author")}: ${nameOrDash(row.void.created_by_name)}`,
          when: format(row.void.created_at),
        }
      : null;
}
