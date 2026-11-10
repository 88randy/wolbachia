/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { List } from "lucide-react";
import { PageHeader } from "../../components/templates/PageHeader";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { SelectMenu } from "../../ui/SelectMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "../../ui/ErrorState";
import { MapBoundary } from "../geography/MapBoundary";
import { useMapDisplay } from "../geography/use-map-display";
import type { GeographyScope } from "../geography/use-w-15";
import type { EditorTool } from "./editor-model";
import { useEditorData } from "./use-editor-data";
import { useMapEditor } from "./use-map-editor";
import { useEditorSaves } from "./use-editor-saves";
import { ToolPicker } from "./ToolPicker";
import { ToolContent } from "./ToolContent";
import { EditorLegend } from "./EditorLegend";

const EditorMap = lazy(() => import("./EditorMap"));

function allowedTools(scope: GeographyScope): ReadonlySet<EditorTool> {
  const tools = new Set<EditorTool>();
  if (scope.canCreateQuadrant) tools.add("quadrant");
  if (scope.canCreatePoint) tools.add("sampling");
  if (scope.canPublish) {
    tools.add("release");
    tools.add("move");
  }
  return tools;
}

export function MapEditorScreen({ scope }: { scope: GeographyScope }) {
  const { t } = useTranslation();
  useDocumentTitle(t("mapEditor.title"));
  const data = useEditorData(scope);
  const editor = useMapEditor(data);
  const saves = useEditorSaves(scope, data, editor);
  const display = useMapDisplay();
  const mapReady = Boolean(editor.draw);
  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4 px-6 pt-5 pb-6">
      <PageHeader
        title={t("mapEditor.title")}
        description={t("mapEditor.description")}
        actions={
          <Link
            to="/quadrants"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-tint"
          >
            <List aria-hidden="true" className="size-4" />
            {t("mapEditor.action.list")}
          </Link>
        }
      />
      <div className="grid flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          aria-label={t("mapEditor.panel")}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <ToolPicker
            active={editor.tool}
            allowed={allowedTools(scope)}
            onSelect={(tool) => {
              saves.clearFailure();
              if (mapReady) editor.setTool(tool);
            }}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="map-editor-quadrant" className="text-[13px] font-semibold text-ink">
              {t("mapEditor.field.quadrant")}
            </label>
            <SelectMenu
              id="map-editor-quadrant"
              value={editor.quadrantId ?? ""}
              placeholder={t("mapEditor.field.quadrantPlaceholder")}
              options={data.quadrants.map((item) => ({ value: item.id, label: item.code }))}
              onValueChange={(value) => {
                editor.selectQuadrant(value || null);
              }}
            />
          </div>
          <div className="border-t border-line pt-4">
            <ToolContent data={data} editor={editor} saves={saves} />
          </div>
          {saves.failedKey && <InlineNotice tone="critical">{t(saves.failedKey)}</InlineNotice>}
          <EditorLegend quadrants={data.quadrants} centers={data.centers} />
        </aside>
        <div className="h-[min(76vh,860px)] min-h-[520px] lg:sticky lg:top-4">
          {data.isError ? (
            <ErrorState onRetry={data.refetch} />
          ) : data.isLoading ? (
            <Skeleton className="h-full w-full rounded-2xl" />
          ) : display.hasFailed || !display.source ? (
            <InlineNotice tone="warning">{t("mapEditor.map.unavailable")}</InlineNotice>
          ) : (
            <MapBoundary>
              <Suspense fallback={<Skeleton className="h-full w-full rounded-2xl" />}>
                <EditorMap
                  data={data}
                  editor={editor}
                  source={display.source}
                  onFailure={display.fail}
                />
              </Suspense>
            </MapBoundary>
          )}
        </div>
      </div>
    </section>
  );
}
