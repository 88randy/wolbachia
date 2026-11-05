import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useDocumentTitle } from "../../shell/use-document-title";
import type { GeographyScope } from "./use-w-15";
import { MapPanel } from "./MapPanel";
import { QuadrantCreateDialog } from "./QuadrantCreateDialog";
import { useQuadrantList } from "./use-quadrant-list";
import styles from "./geography.module.css";
export function QuadrantList({ scope }: { scope: GeographyScope }) {
  const { t } = useTranslation();
  useDocumentTitle(t("geography.page.title"));
  const list = useQuadrantList(scope);
  return (
    <section className={styles.page}>
      <div className={styles.actions}>
        <h1>{t("geography.page.title")}</h1>
        {scope.canCreateQuadrant && (
          <button type="button" onClick={list.open}>
            {t("geography.page.create")}
          </button>
        )}
      </div>
      <FilterBar controller={list.table.controller} />
      <div className={styles.workspace}>
        <MapPanel quadrants={list.query.data?.results ?? []} />
        <DataTable caption={t("geography.page.list")} {...list.table} />
      </div>
      {list.isCreating && <QuadrantCreateDialog scope={scope} onClose={list.close} />}
    </section>
  );
}
