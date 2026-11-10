/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { lazy, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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

function allowedTools(scope: GeographyScope, isFocused: boolean): ReadonlySet<EditorTool> {
  const tools = new Set<EditorTool>();
  if (scope.canCreateQuadrant && !isFocused) tools.add("quadrant");
  if (scope.canCreatePoint) tools.add("sampling");
  if (scope.canPublish) {
    tools.add("release");
    tools.add("move");
  }
  return tools;
}

interface Props {
  scope: GeographyScope;
  /** Quadrant record view: start in "Move or correct" on this quadrant and fit the map to it. */
  focusCode?: string;
  /** The new-quadrant action opens the editor with the drawing tool active. */
  startTool?: "quadrant";
}

/** Tool panel + map. Used full page at /quadrants/editor and inside each quadrant record. */
export function MapEditorWorkspace({ scope, focusCode, startTool }: Props) {
  const { t } = useTranslation();
  const data = useEditorData(scope);
  const editor = useMapEditor(data);
  const saves = useEditorSaves(scope, data, editor);
  const display = useMapDisplay();
  const mapReady = Boolean(editor.draw);
  const focus = focusCode ? data.quadrants.find((item) => item.code === focusCode) : undefined;
  const started = useRef(false);
  useEffect(() => {
    if (!editor.draw || started.current || startTool !== "quadrant" || !scope.canCreateQuadrant)
      return;
    started.current = true;
    editor.setTool("quadrant");
  }, [editor, startTool, scope.canCreateQuadrant]);
  useEffect(() => {
    if (!editor.draw || !focus || started.current || !scope.canPublish) return;
    started.current = true;
    editor.setTool("move");
    editor.selectQuadrant(focus.id);
  }, [editor, focus, scope.canPublish]);
  const viewQuadrants = focus ? [focus] : data.quadrants;
  return (
    <div className="grid flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside
        aria-label={t("mapEditor.panel")}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <ToolPicker
          active={editor.tool}
          allowed={allowedTools(scope, Boolean(focusCode))}
          onSelect={(tool) => {
            saves.clearFailure();
            if (!mapReady) return;
            editor.setTool(tool);
            if (focus) editor.selectQuadrant(focus.id);
          }}
        />
        {!focusCode && (
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
        )}
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
                viewQuadrants={viewQuadrants}
                editor={editor}
                source={display.source}
                onFailure={display.fail}
              />
            </Suspense>
          </MapBoundary>
        )}
      </div>
    </div>
  );
}
