/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Plus } from "lucide-react";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { buttonVariants } from "../../ui/button-variants";
import { useDocumentTitle } from "../../shell/use-document-title";
import type { GeographyScope } from "./use-w-15";
import { LazyGeographyMap } from "./LazyGeographyMap";
import { useQuadrantList } from "./use-quadrant-list";
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
              <Link
                to="/quadrants/editor"
                search={{ tool: "quadrant" }}
                className={buttonVariants({ variant: "secondary" })}
              >
                <Plus aria-hidden="true" className="size-4" />
                {t("geography.page.create")}
              </Link>
            )}
            {canEdit && (
              <Link to="/quadrants/editor" className={buttonVariants({ variant: "primary" })}>
                <MapIcon aria-hidden="true" className="size-4" />
                {t("mapEditor.action.open")}
              </Link>
            )}
          </>
        }
      />
      <FilterBar controller={list.table.controller} />
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DataTable caption={t("geography.page.list")} {...list.table} />
        <section
          aria-label={t("geography.map.label")}
          className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-card xl:sticky xl:top-4"
        >
          <LazyGeographyMap quadrants={list.query.data?.results ?? []} />
        </section>
      </div>
    </PageFrame>
  );
}
