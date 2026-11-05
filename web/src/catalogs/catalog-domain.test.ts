import { describe, expect, test } from "vitest";
import { displayLabel, nextItemSort, planMove } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";

const item = (id: string, sort: number, overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id,
  sort,
  code: id,
  label_es: id,
  label_en: "",
  icon: "",
  is_active: true,
  is_other: false,
  requires_photo: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});
describe("catalog ordering invariants", () => {
  test("swaps neighboring active items, excluding inactive and Other; blocks ends", () => {
    const rows = [
      item("a", 10),
      item("inactive", 15, { is_active: false }),
      item("b", 20),
      item("other", 0, { is_other: true }),
    ];
    expect(planMove(rows, "b", "up")).toEqual([
      { id: "b", sort: 10 },
      { id: "a", sort: 20 },
    ]);
    expect(planMove(rows, "a", "up")).toEqual([]);
    expect(planMove(rows, "b", "down")).toEqual([]);
    expect(planMove(rows, "other", "up")).toEqual([]);
  });
  test("renumbers active items once when seed sorts collide", () => {
    expect(planMove([item("a", 0), item("b", 0), item("c", 0)], "b", "up")).toEqual([
      { id: "b", sort: 10 },
      { id: "a", sort: 20 },
      { id: "c", sort: 30 },
    ]);
  });
  test("English falls back to Spanish API data with a warning", () => {
    expect(displayLabel(item("Rociado", 10), "en")).toEqual({
      label: "Rociado",
      isMissingEnglish: true,
    });
    expect(displayLabel(item("Rociado", 10, { label_en: "Spraying" }), "en")).toEqual({
      label: "Spraying",
      isMissingEnglish: false,
    });
    expect(displayLabel(item("Rociado", 10), "es-MX").isMissingEnglish).toBe(false);
  });
});

describe("new item sort", () => {
  test.each([
    { name: "empty list", rows: [], expected: 10 },
    {
      name: "active items exclude fixed Other",
      rows: [item("a", 10), item("b", 20), item("other", 10000, { is_other: true })],
      expected: 30,
    },
    { name: "cap", rows: [item("a", 10000)], expected: 10000 },
    {
      name: "inactive maximum ignored",
      rows: [item("a", 10), item("old", 10000, { is_active: false })],
      expected: 20,
    },
  ])("$name", ({ rows, expected }) => {
    expect(nextItemSort(rows)).toBe(expected);
  });
});
