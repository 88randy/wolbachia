import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { EditorData } from "./use-editor-data";
import type { DraftShape } from "./editor-draft";
import { DraftFacts } from "./DraftFacts";
import { pointsInside } from "./editor-model";
import { polygonAreaKm2 } from "./geo-math";
import type { Polygon } from "../geography/geometry";

/** A saved quadrant or point that is selected: facts, its record, and how to retire it. */
export function SelectedRecord({ shape, data }: { shape: DraftShape; data: EditorData }) {
  const { t } = useTranslation();
  if (!shape.saved) return null;
  const polygon = shape.kind === "quadrant" ? (shape.geometry as Polygon) : null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-muted p-3">
      <h2 className="m-0 text-sm font-semibold text-ink">
        {t("mapEditor.selected.title", { code: shape.saved.code })}
      </h2>
      {polygon && (
        <DraftFacts
          areaKm2={polygonAreaKm2(polygon)}
          points={pointsInside(polygon, data.points)}
          blocks={data.blocks.filter((item) => item.quadrant === shape.saved?.recordId).length}
        />
      )}
      {polygon && (
        <Link
          to="/quadrants/$code/versions"
          params={{ code: shape.saved.code }}
          className="text-sm font-semibold text-action underline-offset-2 hover:underline"
        >
          {t("mapEditor.browse.open")}
        </Link>
      )}
      <p className="m-0 text-xs text-ink-2">{t("mapEditor.selected.retire")}</p>
    </section>
  );
}
