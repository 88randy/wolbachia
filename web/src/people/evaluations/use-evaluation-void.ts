import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
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
          author: `${t("evaluations.history.author")}: ${row.void.created_by}`,
          when: format(row.void.created_at),
        }
      : null;
}
