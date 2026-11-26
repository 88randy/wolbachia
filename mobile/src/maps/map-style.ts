import type { LayerSpecification, StyleSpecification } from "@maplibre/maplibre-react-native";
import type { Theme } from "@wolbachia/tokens";

const SOURCE = "local";

/** Protomaps v4 layer names. No glyphs or sprites: labels are drawn by the app. */
function fillLayers(theme: Theme): LayerSpecification[] {
  return [
    ["earth", theme.color.surfaceMuted],
    ["landuse", theme.color.status.success.bg],
    ["water", theme.color.status.info.bg],
    ["buildings", theme.color.border.soft],
  ].map(([layer, color]) => ({
    id: `${SOURCE}-${String(layer)}`,
    type: "fill",
    source: SOURCE,
    "source-layer": String(layer),
    paint: { "fill-color": color },
  }));
}

export function buildMapStyle(tilesUri: string, theme: Theme): StyleSpecification {
  return {
    version: 8,
    sources: { [SOURCE]: { type: "vector", url: `pmtiles://${tilesUri}` } },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": theme.color.background },
      },
      ...fillLayers(theme),
      {
        id: `${SOURCE}-roads`,
        type: "line",
        source: SOURCE,
        "source-layer": "roads",
        paint: { "line-color": theme.color.text.tertiary, "line-width": 1.5 },
      },
    ],
  };
}
