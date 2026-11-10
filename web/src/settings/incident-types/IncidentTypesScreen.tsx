/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { Button } from "../../ui/Button";
import { UnconfiguredTypes } from "./UnconfiguredTypes";
import { TypeSelection } from "./TypeSelection";
import { TYPE_PAGE_SIZE } from "./incident-types-query";
import { useW06 } from "./use-w-06";
import { useTypeColumns } from "./type-columns";
import { Plus } from "lucide-react";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { visibleTypeQuery } from "./type-access";
export function IncidentTypesScreen() {
  const { t } = useTranslation();
  const controller = useW06();
  const columns = useTypeColumns(controller.edit);
  useDocumentTitle(t("incidentTypes.page.title"));
  return (
    <PageFrame>
      <PageHeader
        title={t("incidentTypes.page.title")}
        description={t("hub.settings.incidentTypes")}
        actions={
          <Button
            id="type-create"
            leadingIcon={<Plus aria-hidden="true" />}
            onClick={controller.create}
          >
            {t("incidentTypes.page.create")}
          </Button>
        }
      />
      <FilterBar controller={controller.controller} />
      <DataTable
        caption={t("incidentTypes.page.title")}
        columns={columns}
        getRowId={(item) => item.id}
        controller={controller.controller}
        data={pageTableData(
          visibleTypeQuery(controller.query),
          controller.controller.state.page,
          TYPE_PAGE_SIZE,
        )}
      />
      <UnconfiguredTypes scope={controller.scope} configure={controller.configure} />
      <TypeSelection controller={controller} />
    </PageFrame>
  );
}
