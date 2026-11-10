/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { lightTheme } from "@wolbachia/tokens";
import type { Zone } from "./portal-data";

export const LEVELS = ["none", "low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

const LOW_SHARE = 1 / 3;
const MEDIUM_SHARE = 2 / 3;

/** Level of a zone against the busiest one: three bands, and "none" for zero. */
export function levelOf(releases: number, max: number): Level {
  if (releases <= 0 || max <= 0) return "none";
  const share = releases / max;
  if (share <= LOW_SHARE) return "low";
  return share <= MEDIUM_SHARE ? "medium" : "high";
}

const colors = lightTheme.color;

/** Fill and line color of each level, from the tokens. Color is never the only signal: see PATTERNS. */
export const LEVEL_PAINT: Readonly<Record<Level, { fill: string; line: string }>> = {
  none: { fill: colors.surfaceMuted, line: colors.border.default },
  low: { fill: colors.tint, line: colors.action },
  medium: { fill: colors.tint, line: colors.actionStrong },
  high: { fill: colors.action, line: colors.navy },
};

/** CSS twin of each map pattern, for the legend and the table swatches. */
export const SWATCH_BACKGROUND: Readonly<Record<Level, string>> = {
  none: LEVEL_PAINT.none.fill,
  low: `radial-gradient(${LEVEL_PAINT.low.line} 1.5px, transparent 1.6px) 0 0 / 8px 8px, ${LEVEL_PAINT.low.fill}`,
  medium: `repeating-linear-gradient(45deg, ${LEVEL_PAINT.medium.line} 0 2px, transparent 2px 7px), ${LEVEL_PAINT.medium.fill}`,
  high: `repeating-linear-gradient(45deg, ${LEVEL_PAINT.high.line} 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, ${LEVEL_PAINT.high.line} 0 2px, transparent 2px 6px), ${LEVEL_PAINT.high.fill}`,
};

const TILE = 16;

/** Draws the pattern of a level on a small canvas, for the map's `fill-pattern`. */
export function patternImage(level: Level): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  const { fill, line } = LEVEL_PAINT[level];
  context.fillStyle = fill;
  context.fillRect(0, 0, TILE, TILE);
  context.strokeStyle = level === "high" ? colors.onAction : line;
  context.fillStyle = line;
  context.lineWidth = 2;
  if (level === "low") {
    context.beginPath();
    context.arc(TILE / 2, TILE / 2, 2, 0, Math.PI * 2);
    context.fill();
  } else if (level === "medium" || level === "high") {
    context.beginPath();
    context.moveTo(0, TILE);
    context.lineTo(TILE, 0);
    context.moveTo(-TILE / 2, TILE / 2);
    context.lineTo(TILE / 2, -TILE / 2);
    context.moveTo(TILE / 2, TILE + TILE / 2);
    context.lineTo(TILE + TILE / 2, TILE / 2);
    context.stroke();
    if (level === "high") {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(TILE, TILE);
      context.stroke();
    }
  }
  return context.getImageData(0, 0, TILE, TILE);
}

export function maxReleases(zones: readonly Zone[]): number {
  return zones.reduce((max, zone) => Math.max(max, zone.releases), 0);
}
