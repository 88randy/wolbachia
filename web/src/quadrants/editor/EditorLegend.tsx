/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { centerPatterns } from "./editor-model";

interface Props {
  quadrants: readonly Schemas["Quadrant"][];
  centers: readonly Schemas["Center"][];
}

function LineSwatch({ dashed, muted }: { dashed: boolean; muted?: boolean }) {
  return (
    <svg aria-hidden="true" width="28" height="12" className="flex-none">
      <line
        x1="2"
        y1="6"
        x2="26"
        y2="6"
        strokeWidth={muted ? 1.5 : 3}
        strokeDasharray={dashed ? "6 4" : muted ? "3 3" : undefined}
        className={muted ? "stroke-ink-3" : dashed ? "stroke-warning-fg" : "stroke-action"}
      />
    </svg>
  );
}

/** Color always comes with a pattern or a shape and a name. */
export function EditorLegend({ quadrants, centers }: Props) {
  const { t } = useTranslation();
  const used = [...new Set(quadrants.map((item) => item.center))].sort();
  const centerPattern = centerPatterns(quadrants);
  const nameOf = new Map(centers.map((item) => [item.id, item.name]));
  return (
    <section
      aria-label={t("mapEditor.legend.title")}
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-ink"
    >
      <h2 className="m-0 text-xs font-semibold text-ink-2">{t("mapEditor.legend.title")}</h2>
      {used.map((center) => (
        <p key={center} className="m-0 flex items-center gap-2">
          <LineSwatch dashed={centerPattern(center) === "dashed"} />
          {t("mapEditor.legend.center", { center: nameOf.get(center) ?? "" })}
        </p>
      ))}
      <p className="m-0 flex items-center gap-2">
        <LineSwatch dashed={false} muted />
        {t("mapEditor.legend.block")}
      </p>
      <p className="m-0 flex items-center gap-2">
        <svg aria-hidden="true" width="28" height="14" className="flex-none">
          <circle cx="14" cy="7" r="5" className="fill-action stroke-surface" strokeWidth="2" />
        </svg>
        {t("mapEditor.legend.sampling")}
      </p>
      <p className="m-0 flex items-center gap-2">
        <svg aria-hidden="true" width="28" height="14" className="flex-none">
          <circle
            cx="14"
            cy="7"
            r="4.5"
            className="fill-surface stroke-success-fg"
            strokeWidth="3"
          />
        </svg>
        {t("mapEditor.legend.release")}
      </p>
    </section>
  );
}
