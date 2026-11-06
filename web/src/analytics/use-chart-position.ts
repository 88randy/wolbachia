import { useState } from "react";
import type { PointerEvent } from "react";
import { GEOMETRY } from "./chart-geometry";
/** Pointer and range-input keyboard navigation share the exact same selected period. */
export function useChartPosition(count: number) {
  const [active, setActive] = useState<number | null>(null);
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = (
      event.currentTarget.querySelector("svg") ?? event.currentTarget
    ).getBoundingClientRect();
    const padding = (bounds.width * GEOMETRY.padding) / GEOMETRY.width;
    const fraction =
      (event.clientX - bounds.left - padding) / Math.max(1, bounds.width - 2 * padding);
    setActive(Math.min(count - 1, Math.max(0, Math.round(fraction * (count - 1)))));
  }
  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.parentElement?.contains(document.activeElement)) setActive(null);
  }
  return { active, setActive, onPointerMove, onPointerLeave };
}
