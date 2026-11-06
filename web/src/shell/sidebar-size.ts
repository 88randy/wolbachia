import { web } from "@wolbachia/tokens";

/** All persisted and live widths pass the same finite, pixel-based boundary. */
export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return web.layout.sidebarWidth;
  return Math.round(
    Math.min(web.layout.sidebarMaxWidth, Math.max(web.layout.sidebarMinWidth, width)),
  );
}

export function parseSidebarWidth(stored: string | null): number {
  if (stored === null || stored.trim() === "") return web.layout.sidebarWidth;
  return clampSidebarWidth(Number(stored));
}

export function stepSidebarWidth(width: number, direction: -1 | 1): number {
  return clampSidebarWidth(width + direction * web.layout.sidebarResizeStep);
}
