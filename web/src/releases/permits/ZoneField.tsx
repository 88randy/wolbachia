import { lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { readMapSource } from "../../quadrants/geography/map-source";
import { Button } from "../../ui/Button";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { InlineNotice } from "../../ui/InlineNotice";
import { parsePolygon } from "./permit-geometry";
import type { PolygonBody } from "./permit-geometry";
import { PermitZoneTable } from "./PermitZoneTable";
import type { usePermitForm } from "./use-permit-form";
import { ZoneQuadrantPicker } from "./ZoneQuadrantPicker";

const ZoneDrawMap = lazy(() => import("./ZoneDrawMap"));

type Mode = "draw" | "quadrants";

function useCanDraw() {
  const source = readMapSource({
    VITE_MAP_TILES_URL: import.meta.env["VITE_MAP_TILES_URL"],
    VITE_MAP_ATTRIBUTION: import.meta.env["VITE_MAP_ATTRIBUTION"],
  });
  return { source, canDraw: source !== null && typeof WebGL2RenderingContext !== "undefined" };
}

interface Props {
  form: ReturnType<typeof usePermitForm>;
}

/**
 * The permit zone is never typed: it is drawn on the map, or built from ticked quadrants. The
 * vertices are shown read-only under "Avanzado".
 */
export function ZoneField({ form }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const { source, canDraw } = useCanDraw();
  const [mode, setMode] = useState<Mode>(canDraw ? "draw" : "quadrants");
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const zone = parsePolygon(form.draft.geometry);
  const quadrants = form.choices?.quadrants ?? [];
  const write = (next: PolygonBody | null) => {
    form.change("geometry", next === null ? "" : JSON.stringify(next));
  };
  const error = form.errors.geometry;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" aria-describedby={`${id}-e`}>
      <legend className="mb-1 text-[13px] font-semibold text-ink">
        {t("permits.form.geometry")}
      </legend>
      <div className="flex gap-2">
        {canDraw && !failed && (
          <Button
            variant={mode === "draw" ? "secondary" : "tertiary"}
            size="sm"
            aria-pressed={mode === "draw"}
            onClick={() => {
              setMode("draw");
            }}
          >
            {t("permits.zone.modeDraw")}
          </Button>
        )}
        <Button
          variant={mode === "quadrants" ? "secondary" : "tertiary"}
          size="sm"
          aria-pressed={mode === "quadrants"}
          onClick={() => {
            setMode("quadrants");
          }}
        >
          {t("permits.zone.modeQuadrants")}
        </Button>
      </div>
      {mode === "draw" && source !== null && canDraw && !failed ? (
        <Suspense fallback={<CardSkeleton />}>
          <ZoneDrawMap
            source={source}
            quadrants={quadrants}
            zone={zone}
            onZone={write}
            onFailure={() => {
              setFailed(true);
              setMode("quadrants");
            }}
          />
        </Suspense>
      ) : (
        <ZoneQuadrantPicker
          quadrants={quadrants}
          selected={picked}
          onSelect={(ids, next) => {
            setPicked(ids);
            write(next);
          }}
        />
      )}
      {failed && <InlineNotice tone="info">{t("permits.zone.mapUnavailable")}</InlineNotice>}
      <p
        id={`${id}-e`}
        role={error === undefined ? undefined : "alert"}
        className="m-0 text-xs text-critical-fg"
      >
        {error === undefined ? "" : t(error)}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink-2">
          {t("permits.zone.advanced")}
        </summary>
        <PermitZoneTable geometry={zone} />
      </details>
    </fieldset>
  );
}
