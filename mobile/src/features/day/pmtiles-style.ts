import type { StyleSpecification, LayerSpecification } from "@maplibre/maplibre-react-native";
import type { Theme } from "@wolbachia/tokens";
import type { MapFile } from "./map-coverage.ts";
function fillLayers(source: string, theme: Theme): LayerSpecification[] {
  return [
    ["earth", theme.color.background],
    ["landuse", theme.color.status.success.bg],
    ["water", theme.color.status.info.bg],
    ["buildings", theme.color.border.default],
  ].map(([layer, color]) => ({
    id: `${source}-${String(layer)}`,
    type: "fill",
    source,
    "source-layer": String(layer),
    paint: { "fill-color": color },
  }));
}
function assetLayers(source: string, theme: Theme): LayerSpecification[] {
  return [
    ...fillLayers(source, theme),
    {
      id: `${source}-roads`,
      type: "line",
      source,
      "source-layer": "roads",
      paint: { "line-color": theme.color.text.tertiary, "line-width": 2 },
    },
  ];
}
/** #64 local source approach, no OfflineManager. [ASSUMPTION] Archives use Protomaps v4 layer names.
 * No bundled glyphs yet: no tile text/sprites or remote style URLs; app markers draw point labels. */
export function buildPmtilesStyle(files: readonly MapFile[], theme: Theme): StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      files.map((file, index) => [
        `local-${String(index)}`,
        {
          type: "vector" as const,
          url: `pmtiles://${file.fileRef}`,
        },
      ]),
    ),
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": theme.color.background },
      },
      ...files.flatMap((_, index) => assetLayers(`local-${String(index)}`, theme)),
    ],
  };
}
