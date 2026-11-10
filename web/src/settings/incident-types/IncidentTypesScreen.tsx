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
import page from "../../styles/page.module.css";
import styles from "./incident-types.module.css";
import { visibleTypeQuery } from "./type-access";
export function IncidentTypesScreen() {
  const { t } = useTranslation();
  const controller = useW06();
  const columns = useTypeColumns(controller.edit);
  useDocumentTitle(t("incidentTypes.page.title"));
  return (
    <section className={page.page}>
      <div className={styles.heading}>
        <h1 className={page.title}>{t("incidentTypes.page.title")}</h1>
        <Button id="type-create" onClick={controller.create}>
          {t("incidentTypes.page.create")}
        </Button>
      </div>
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
    </section>
  );
}
