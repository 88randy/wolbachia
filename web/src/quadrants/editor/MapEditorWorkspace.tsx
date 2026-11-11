/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusLine } from "./EditorStatusLine";
import { PendingPanel } from "./PendingPanel";
import { SelectedRecord } from "./SelectedRecord";
import { LeaveGuard } from "./LeaveGuard";
import { EditorLegend } from "./EditorLegend";

const EditorMap = lazy(() => import("./EditorMap"));

function allowedTools(scope: GeographyScope, isFocused: boolean): ReadonlySet<EditorTool> {
  const tools = new Set<EditorTool>(["select"]);
  if (scope.canCreateQuadrant && !isFocused) tools.add("quadrant");
  if (scope.canCreatePoint) tools.add("sampling");
  if (scope.canPublish) {
    tools.add("release");
    tools.add("block");
  }
  return tools;
}

interface Props {
  scope: GeographyScope;
  /** Quadrant record view: start with this quadrant selected and fit the map to it. */
  focusCode?: string;
  /** The new-quadrant action opens the editor with the drawing tool active. */
  startTool?: "quadrant";
}

/** Toolbar + map on the right, the draft (everything unsaved) on the left. */
export function MapEditorWorkspace({ scope, focusCode, startTool }: Props) {
  const { t } = useTranslation();
  const data = useEditorData(scope);
  const editor = useMapEditor(data);
  const saves = useEditorSaves(scope, data, editor);
  const display = useMapDisplay();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const allowed = allowedTools(scope, Boolean(focusCode));
  const focus = focusCode ? data.quadrants.find((item) => item.code === focusCode) : undefined;
  const started = useRef(false);
  const { draw, setTool, load } = editor;
  useEffect(() => {
    if (!draw || started.current) return;
    if (startTool === "quadrant" && scope.canCreateQuadrant) {
      started.current = true;
      setTool("quadrant");
    } else if (focus && scope.canPublish) {
      started.current = true;
      load("quadrant", focus.id);
    }
  }, [draw, startTool, focus, scope.canCreateQuadrant, scope.canPublish, setTool, load]);
  useEditorShortcuts({
    editor,
    allowed,
    onSave: () => void saves.saveAll(),
    onHelp: () => {
      setHelpOpen((open) => !open);
    },
    isBusy: saves.isBusy,
  });
  const viewQuadrants = focus ? [focus] : data.quadrants;
  const pickedQuadrant = editor.selected?.kind === "quadrant" ? editor.selected.saved : null;
  return (
    <div className="grid flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <LeaveGuard pendingCount={editor.pendingCount} />
      <aside
        aria-label={t("mapEditor.panel")}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        {scope.canPublish && !focusCode && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="map-editor-quadrant" className="text-[13px] font-semibold text-ink">
              {t("mapEditor.fixed.label")}
            </label>
            <SelectMenu
              id="map-editor-quadrant"
              value={pickedQuadrant?.recordId ?? ""}
              placeholder={t("mapEditor.field.quadrantPlaceholder")}
              options={data.quadrants.map((item) => ({ value: item.id, label: item.code }))}
              onValueChange={(value) => {
                if (!value) return;
                editor.load("quadrant", value);
                editor.fitQuadrant(value);
              }}
            />
          </div>
        )}
        <PendingPanel data={data} editor={editor} saves={saves} />
        {editor.selected?.saved && <SelectedRecord shape={editor.selected} data={data} />}
        <EditorLegend quadrants={data.quadrants} centers={data.centers} />
      </aside>
      <div className="flex h-[min(80vh,900px)] min-h-[560px] flex-col gap-3 lg:sticky lg:top-4">
        <EditorToolbar
          editor={editor}
          allowed={allowed}
          isBusy={saves.isBusy}
          isHelpOpen={isHelpOpen}
          onHelpChange={setHelpOpen}
        />
        <EditorStatusLine editor={editor} />
        <div className="min-h-0 flex-1">
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
                  canEdit={scope.canPublish}
                  onFailure={display.fail}
                />
              </Suspense>
            </MapBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
