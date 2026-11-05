import type { LayerProps } from "react-map-gl/maplibre";
import { web } from "@wolbachia/tokens";
import type { lightTheme } from "@wolbachia/tokens";
import type { FilterSpecification } from "maplibre-gl";
import type { LayerVisibility } from "./use-map-display";
type Colors = typeof lightTheme.color;
interface LineOptions {
  id: string;
  color: string;
  filter: FilterSpecification;
  dash?: number[];
}
function line({ id, color, filter, dash }: LineOptions): LayerProps {
  return {
    id,
    type: "line",
    filter,
    paint: {
      "line-color": color,
      "line-width": web.focus.ring.width,
      ...(dash ? { "line-dasharray": dash } : {}),
    },
  };
}
function quadrantLayers(colors: Colors): LayerProps[] {
  return [
    line({
      id: "quadrants-solid",
      color: colors.action,
      filter: ["all", ["==", ["get", "kind"], "quadrant"], ["==", ["get", "pattern"], "solid"]],
    }),
    line({
      id: "quadrants-dashed",
      color: colors.status.warning.fg,
      filter: ["all", ["==", ["get", "kind"], "quadrant"], ["==", ["get", "pattern"], "dashed"]],
      dash: [web.icon.sm, web.focus.ring.width],
    }),
  ];
}
export function polygonLayers({
  colors,
  visible,
}: {
  colors: Colors;
  visible: LayerVisibility;
}): LayerProps[] {
  const layers = visible.quadrant ? quadrantLayers(colors) : [];
  if (visible.block)
    layers.push(
      line({
        id: "blocks",
        color: colors.text.primary,
        filter: ["==", ["get", "kind"], "block"],
        dash: [web.focus.ring.width, web.focus.ring.width],
      }),
    );
  if (visible.draft)
    layers.push(
      line({
        id: "draft",
        color: colors.status.warning.fg,
        filter: ["==", ["get", "kind"], "draft"],
        dash: [web.focus.ring.width, web.icon.sm],
      }),
    );
  return layers;
}
export function pointLayer(colors: Colors): LayerProps {
  return {
    id: "points",
    type: "circle",
    paint: {
      "circle-color": colors.action,
      "circle-radius": web.icon.sm / 2,
      "circle-stroke-color": colors.surface,
      "circle-stroke-width": web.focus.ring.width,
    },
  };
}
