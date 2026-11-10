import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { DataTableColumn } from "../../data-table/table-types";
import { OUTCOME_KEYS } from "./evaluation-labels";
import { useTrainingLabels } from "../trainings/use-training-labels";
import type { Evaluation } from "./evaluation-query";
function identityColumn(t: TFunction): DataTableColumn<Evaluation> {
  return {
    id: "id",
    headerKey: "evaluations.history.id",
    cell: () => t("evaluations.history.open"),
    link: (row) => ({
      to: "/people/evaluations",
      search: (previous) => ({ ...previous, item: row.id }),
    }),
  };
}
function scoreColumn(t: TFunction): DataTableColumn<Evaluation> {
  return {
    id: "score",
    headerKey: "evaluations.result.score",
    align: "end",
    link: (row) => ({
      to: "/people/evaluations",
      search: (previous) => ({ ...previous, item: row.id }),
    }),
    cell: (row) => row.current?.score ?? t("evaluations.field.unanswered"),
  };
}
export function useEvaluationColumns(): DataTableColumn<Evaluation>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const labels = useTrainingLabels();
  return [
    identityColumn(t),
    {
      id: "subject",
      headerKey: "evaluations.field.subject",
      cell: (row) => labels.person(row.subject_id),
    },
    {
      id: "outcome",
      headerKey: "evaluations.result.title",
      cell: (row) =>
        row.current ? t(OUTCOME_KEYS[row.current.outcome]) : t("evaluations.history.unavailable"),
    },
    scoreColumn(t),
    {
      id: "created_at",
      headerKey: "evaluations.history.recorded",
      cell: (row) => format(row.created_at),
    },
  ];
}
