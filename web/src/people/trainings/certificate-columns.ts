import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useTranslation } from "react-i18next";
import type { Certificate } from "./training-query";
import { useTrainingLabels } from "./use-training-labels";
export function useCertificateColumns(): DataTableColumn<Certificate>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const labels = useTrainingLabels();
  return [
    {
      id: "training_version_id",
      headerKey: "trainings.field.trainingVersion",
      cell: (row) => labels.version(row.training_version_id),
    },
    {
      id: "valid_from",
      headerKey: "trainings.field.validFrom",
      cell: (row) => format(row.valid_from),
    },
    { id: "valid_to", headerKey: "trainings.field.validTo", cell: (row) => format(row.valid_to) },
    {
      id: "revoked_from",
      headerKey: "trainings.field.revoked",
      cell: (row) =>
        row.revoked_from ? format(row.revoked_from) : t("trainings.state.notRevoked"),
    },
  ];
}
