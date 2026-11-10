import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import {
  typeNameColumn,
  typeSeverityColumn,
  typeSupervisorColumn,
  typeSlaColumn,
  typeStateColumn,
} from "./type-column-values";
export function useTypeColumns(edit: (code: string) => void) {
  const { t, i18n } = useTranslation();
  return useMemo(
    () => [
      typeNameColumn(edit),
      typeSeverityColumn(t),
      typeSupervisorColumn(t),
      typeSlaColumn(i18n.language),
      typeStateColumn(t),
    ],
    [edit, t, i18n.language],
  );
}
