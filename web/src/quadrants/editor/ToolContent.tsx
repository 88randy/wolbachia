import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import { QuadrantDraftForm } from "./QuadrantDraftForm";
import { PointDraftForm } from "./PointDraftForm";
import { MovePanel } from "./MovePanel";
import { DraftFacts } from "./DraftFacts";
import { geometryOf, pointsInside } from "./editor-model";
import { polygonAreaKm2 } from "./geo-math";

interface Props {
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
}

function SelectedQuadrant({ data, editor }: Omit<Props, "saves">) {
  const { t } = useTranslation();
  const quadrant = data.quadrants.find((item) => item.id === editor.quadrantId);
  const geometry = quadrant ? geometryOf(quadrant) : null;
  if (!quadrant || !geometry)
    return <p className="m-0 text-sm text-ink-2">{t("mapEditor.browse.help")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold text-ink">{quadrant.code}</h2>
      <DraftFacts
        areaKm2={polygonAreaKm2(geometry)}
        points={pointsInside(geometry, data.points)}
        blocks={data.blocks.filter((item) => item.quadrant === quadrant.id).length}
      />
      <Link
        to="/quadrants/$code/versions"
        params={{ code: quadrant.code }}
        className="text-sm font-semibold text-action underline-offset-2 hover:underline"
      >
        {t("mapEditor.browse.open")}
      </Link>
    </div>
  );
}

/** The panel below the tools follows the active tool. Keys reset each form per draft. */
export function ToolContent({ data, editor, saves }: Props) {
  if (editor.tool === "quadrant")
    return (
      <QuadrantDraftForm
        key={editor.quadrantDraft?.featureId ?? "new"}
        data={data}
        editor={editor}
        saves={saves}
      />
    );
  if (editor.tool === "sampling" || editor.tool === "release")
    return (
      <PointDraftForm
        key={editor.tool}
        data={data}
        editor={editor}
        saves={saves}
        kind={editor.tool}
      />
    );
  if (editor.tool === "move")
    return (
      <MovePanel key={editor.quadrantId ?? "none"} data={data} editor={editor} saves={saves} />
    );
  return <SelectedQuadrant data={data} editor={editor} />;
}
