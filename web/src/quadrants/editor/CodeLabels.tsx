import { Marker } from "react-map-gl/maplibre";
import { useZoom } from "../geography/AreaLabels";

/** Below this zoom the codes would pile on top of each other, so they wait. */
const CODE_MIN_ZOOM = 13;

interface Label {
  id: string;
  code: string;
  at: readonly [number, number];
}

/** Quadrant and block codes on the map, only once there is room for them. */
export function CodeLabels({ labels }: { labels: readonly Label[] }) {
  const zoom = useZoom();
  if (zoom < CODE_MIN_ZOOM) return null;
  return (
    <>
      {labels.map((item) => (
        <Marker key={item.id} longitude={item.at[0]} latitude={item.at[1]} anchor="center">
          <span className="pointer-events-none rounded-md bg-surface/90 px-1.5 py-0.5 text-xs font-bold text-ink shadow-card">
            {item.code}
          </span>
        </Marker>
      ))}
    </>
  );
}
