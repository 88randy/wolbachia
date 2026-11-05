import type { Locale } from "@wolbachia/i18n";
import type { CatalogItem } from "./catalogs-query";
export type Direction = "up" | "down";
export const ACTIVE_LIMIT = 200;
const SORT_STEP = 10;
const MAX_SORT = 10000;

/** Labels are API data, never message keys. */
export function displayLabel(row: { label_es: string; label_en: string }, language: Locale) {
  const isMissingEnglish = language === "en" && row.label_en.trim() === "";
  return {
    label: language === "en" && !isMissingEnglish ? row.label_en : row.label_es,
    isMissingEnglish,
  };
}

/** No write for ends, inactive items or the fixed Other item. */
export function moveOrderedIds(items: readonly CatalogItem[], id: string, direction: Direction) {
  const active = items.filter((item) => item.is_active && !item.is_other);
  const index = active.findIndex((item) => item.id === id);
  const neighborIndex = index + (direction === "up" ? -1 : 1);
  const current = active[index];
  const neighbor = active[neighborIndex];
  if (current === undefined || neighbor === undefined) return [];
  const swapped = [...active];
  swapped[index] = neighbor;
  swapped[neighborIndex] = current;
  return swapped.map((item) => item.id);
}

/** Append after active regular items, preserving the editor's ten-step spacing. */
export function nextItemSort(items: readonly CatalogItem[]): number {
  const highest = items.reduce(
    (maximum, item) => (item.is_active && !item.is_other ? Math.max(maximum, item.sort) : maximum),
    0,
  );
  return Math.min(highest + SORT_STEP, MAX_SORT);
}
