/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Plus } from "lucide-react";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useDocumentTitle } from "../../shell/use-document-title";
import { Button } from "../../ui/Button";
import type { GeographyScope } from "./use-w-15";
import { MapPanel } from "./MapPanel";
import { QuadrantCreateDialog } from "./QuadrantCreateDialog";
import { useQuadrantList } from "./use-quadrant-list";
import styles from "./geography.module.css";
export function QuadrantList({ scope }: { scope: GeographyScope }) {
  const { t } = useTranslation();
  useDocumentTitle(t("geography.page.title"));
  const list = useQuadrantList(scope);
  const canEdit = scope.canPublish || scope.canCreatePoint;
  return (
    <PageFrame>
      <PageHeader
        title={t("geography.page.title")}
        actions={
          <>
            {scope.canCreateQuadrant && (
              <Button
                variant="secondary"
                leadingIcon={<Plus aria-hidden="true" />}
                onClick={list.open}
              >
                {t("geography.page.create")}
              </Button>
            )}
            {canEdit && (
              <Link
                to="/quadrants/editor"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-strong"
              >
                <MapIcon aria-hidden="true" className="size-4" />
                {t("mapEditor.action.open")}
              </Link>
            )}
          </>
        }
      />
      <FilterBar controller={list.table.controller} />
      <div className={styles.workspace}>
        <MapPanel quadrants={list.query.data?.results ?? []} />
        <DataTable caption={t("geography.page.list")} {...list.table} />
      </div>
      {list.isCreating && <QuadrantCreateDialog scope={scope} onClose={list.close} />}
    </PageFrame>
  );
}
