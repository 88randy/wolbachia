import { useState } from "react";
import { readMapSource } from "./map-source";
export const MAP_LAYER_LABELS = {
  quadrant: "geography.map.quadrants",
  block: "geography.map.blocks",
  points: "geography.map.points",
  draft: "geography.map.draft",
} as const;
export type LayerVisibility = Record<keyof typeof MAP_LAYER_LABELS, boolean>;
export function useMapDisplay() {
  const [hasFailed, setFailed] = useState(false);
  const [visible, setVisible] = useState<LayerVisibility>({
    quadrant: true,
    block: true,
    points: true,
    draft: true,
  });
  const source = readMapSource({
    VITE_MAP_TILES_URL: import.meta.env["VITE_MAP_TILES_URL"],
    VITE_MAP_ATTRIBUTION: import.meta.env["VITE_MAP_ATTRIBUTION"],
  });
  return {
    visible,
    setVisible,
    source,
    hasFailed: hasFailed || typeof WebGL2RenderingContext === "undefined",
    fail: () => {
      setFailed(true);
    },
  };
}
