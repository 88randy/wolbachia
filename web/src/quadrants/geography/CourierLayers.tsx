import { Flag, Play } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import { web } from "@wolbachia/tokens";
import type { MapProps } from "./map-types";
import { useMapTheme } from "./use-map-theme";
import { CourierDot } from "./CourierDot";

type Props = Pick<MapProps, "couriers" | "track">;
/** The dot, not the label, sits on the position. */
const DOT_OFFSET: [number, number] = [-web.icon.lg / 2, 0];

/** Couriers' last positions and one courier's track with start and end markers (W28, W29). */
export function CourierLayers({ couriers = [], track = [] }: Props) {
  const { t } = useTranslation();
  const start = track[0]?.[0];
  const end = track.at(-1)?.at(-1);
  return (
    <>
      {track.length > 0 && <TrackLine track={track} />}
      {start && (
        <EndMarker at={start} label={t("shift.track.start")} icon={<Play aria-hidden="true" />} />
      )}
      {end && (
        <EndMarker at={end} label={t("shift.track.end")} icon={<Flag aria-hidden="true" />} />
      )}
      {couriers.map((courier) => (
        <Marker
          key={courier.id}
          longitude={courier.at[0]}
          latitude={courier.at[1]}
          anchor="left"
          offset={DOT_OFFSET}
          className="pointer-events-none"
        >
          <CourierDot label={courier.label} isStale={courier.isStale} />
        </Marker>
      ))}
    </>
  );
}

function TrackLine({ track }: { track: NonNullable<MapProps["track"]> }) {
  const colors = useMapTheme();
  return (
    <Source
      id="courier-track"
      type="geojson"
      data={{
        type: "Feature",
        properties: {},
        geometry: { type: "MultiLineString", coordinates: [...track] },
      }}
    >
      <Layer
        id="courier-track-line"
        type="line"
        paint={{ "line-color": colors.actionStrong, "line-width": web.focus.ring.width * 2 }}
      />
    </Source>
  );
}

function EndMarker({ at, label, icon }: { at: [number, number]; label: string; icon: ReactNode }) {
  return (
    <Marker longitude={at[0]} latitude={at[1]} anchor="bottom" className="pointer-events-none">
      <span className="flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-semibold text-ink [&>svg]:size-3.5">
        {icon}
        {label}
      </span>
    </Marker>
  );
}
