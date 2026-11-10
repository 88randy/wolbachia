import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { maxGpsAccuracy } from "./permit-requirements";
import type { PermitType } from "./permits-query";
import styles from "./permits.module.css";

/** Columns of the permit types table; the requirement is read from the type's own JSON. */
export function usePermitTypeColumns(): readonly DataTableColumn<PermitType>[] {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  return useMemo(
    () => [
      {
        id: "code",
        headerKey: "permits.types.columnCode",
        cell: (row) => <span className={styles.code}>{row.code}</span>,
      },
      { id: "name", headerKey: "permits.types.columnName", cell: (row) => row.name },
      {
        id: "requirement",
        headerKey: "permits.types.columnRequirement",
        cell: (row) => {
          const meters = maxGpsAccuracy(row.requirements);
          return meters === null
            ? t("permits.types.requirementUnknown")
            : t("permits.types.requirement", { meters });
        },
      },
      {
        id: "created_at",
        headerKey: "permits.types.columnCreated",
        cell: (row) => formatDateTime(row.created_at),
      },
    ],
    [t, formatDateTime],
  );
}
