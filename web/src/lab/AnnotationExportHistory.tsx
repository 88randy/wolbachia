import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { Card } from "../ui/Card";
import {
  annotationExportsOptions,
  EXPORT_PAGE_SIZE,
  EXPORT_TABLE,
} from "./annotation-export-query";
import type { LabScope } from "./lab-query";
import { useAnnotationExportColumns } from "./use-annotation-export-columns";

export function AnnotationExportHistory({ scope }: { scope: LabScope }) {
  const { t } = useTranslation();
  const controller = useTableUrlState(EXPORT_TABLE);
  const query = useQuery(annotationExportsOptions(scope, controller.state.page));
  const columns = useAnnotationExportColumns(scope);
  return (
    <Card title={t("annotationExport.list.title")} headingLevel={2}>
      <p className="mt-0 text-sm text-ink-2">{t("annotationExport.list.hint")}</p>
      <DataTable
        caption={t("annotationExport.list.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, EXPORT_PAGE_SIZE)}
      />
    </Card>
  );
}
