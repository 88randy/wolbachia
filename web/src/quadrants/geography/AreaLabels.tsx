/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): map measurements, split after the demo. */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, useMap } from "react-map-gl/maplibre";
import type { Schemas } from "@wolbachia/api-client";
import { centroid } from "../editor/geo-math";
import { compactAreaText } from "./area-format";

/** Quadrant labels appear once a quadrant is big enough on screen; blocks need more zoom. */
const QUADRANT_MIN_ZOOM = 13;
const BLOCK_MIN_ZOOM = 15;
/** Below the quadrant code label the editor draws at the same center. */
const QUADRANT_OFFSET: [number, number] = [0, 16];

type Measured = Pick<Schemas["Quadrant"] | Schemas["Block"], "id" | "current_version">;

interface Props {
  quadrants?: readonly Measured[];
  blocks?: readonly Measured[];
  /** Records the map draws elsewhere (e.g. being edited) get no saved-area label. */
  hiddenIds?: ReadonlySet<string>;
  /** Push quadrant labels below a code label drawn at the same center. */
  hasCodeLabels?: boolean;
}

function useZoom(): number {
  const { current: map } = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);
  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      setZoom(map.getZoom());
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return zoom;
}

/**
 * Saved area at the center of each quadrant and block: small muted text with a halo, no
 * pointer events, hidden at zooms where it would crowd the map.
 */
export function AreaLabels({ quadrants = [], blocks = [], hiddenIds, hasCodeLabels }: Props) {
  const { t, i18n } = useTranslation();
  const zoom = useZoom();
  const items = useMemo(() => {
    const of = (records: readonly Measured[], kind: "quadrant" | "block") =>
      records.flatMap((record) => {
        const version = record.current_version;
        if (!version || version.area_m2 == null || hiddenIds?.has(record.id)) return [];
        return [{ id: record.id, kind, area: version.area_m2, at: centroid(version.geometry) }];
      });
    return [
      ...(zoom >= QUADRANT_MIN_ZOOM ? of(quadrants, "quadrant") : []),
      ...(zoom >= BLOCK_MIN_ZOOM ? of(blocks, "block") : []),
    ];
  }, [quadrants, blocks, hiddenIds, zoom]);
  return (
    <>
      {items.map((item) => (
        <Marker
          key={`${item.kind}-${item.id}`}
          longitude={item.at[0]}
          latitude={item.at[1]}
          anchor="center"
          offset={item.kind === "quadrant" && hasCodeLabels ? QUADRANT_OFFSET : undefined}
          style={{ pointerEvents: "none" }}
        >
          <span
            className="pointer-events-none text-[11px] leading-none whitespace-nowrap text-ink-2 tabular-nums"
            style={{
              textShadow:
                "0 0 2px var(--color-surface), 0 0 2px var(--color-surface), 0 0 3px var(--color-surface)",
            }}
          >
            {compactAreaText(t, i18n.language, item.area, item.kind === "quadrant")}
          </span>
        </Marker>
      ))}
    </>
  );
}
