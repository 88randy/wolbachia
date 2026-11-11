import type { Schemas } from "@wolbachia/api-client";
import type { Polygon } from "../geography/geometry";
import { containsLocation } from "../geography/geometry";

export type EditorTool = "select" | "quadrant" | "block" | "sampling" | "release";
export type PointKind = "sampling" | "release";

export function geometryOf(item: { current_version: { geometry: Polygon } | null }) {
  return item.current_version?.geometry ?? null;
}

export function quadrantAt(quadrants: readonly Schemas["Quadrant"][], location: number[]) {
  return quadrants.find((item) => {
    const geometry = geometryOf(item);
    return geometry ? containsLocation(geometry, location) : false;
  });
}

export function blockAt(blocks: readonly Schemas["Block"][], location: number[]) {
  return blocks.find((item) => {
    const geometry = geometryOf(item);
    return geometry ? containsLocation(geometry, location) : false;
  });
}

const CODE_PATTERN = /^(.*?)(\d+)$/;

/** Suggest the next human code following the most common existing prefix. */
export function nextCode(existing: readonly string[], fallbackPrefix: string): string {
  const groups = new Map<string, { count: number; max: number; width: number }>();
  for (const code of existing) {
    const match = CODE_PATTERN.exec(code);
    if (!match) continue;
    const [, prefix = "", digits = ""] = match;
    const group = groups.get(prefix) ?? { count: 0, max: 0, width: digits.length };
    group.count += 1;
    group.max = Math.max(group.max, Number(digits));
    group.width = Math.max(group.width, digits.length);
    groups.set(prefix, group);
  }
  const [prefix, group] = [...groups.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [
    fallbackPrefix,
    { count: 0, max: 0, width: 1 },
  ];
  const taken = new Set(existing);
  let next = group.max + 1;
  let code = `${prefix}${String(next).padStart(group.width, "0")}`;
  while (taken.has(code)) {
    next += 1;
    code = `${prefix}${String(next).padStart(group.width, "0")}`;
  }
  return code;
}

export function pointsInside(
  polygon: Polygon,
  points: readonly { current_version: { location: number[] } | null }[],
): number {
  return points.filter(
    (item) => item.current_version && containsLocation(polygon, item.current_version.location),
  ).length;
}

export type LinePattern = "solid" | "dashed";

/** Centers alternate solid and dashed outlines (color is never the only cue). */
export function centerPatterns(quadrants: readonly Schemas["Quadrant"][]) {
  const centers = [...new Set(quadrants.map((item) => item.center))].sort();
  const patterns = new Map(
    centers.map((center, index) => [center, index % 2 ? "dashed" : "solid"] as const),
  );
  return (center: string): LinePattern => patterns.get(center) ?? "solid";
}
