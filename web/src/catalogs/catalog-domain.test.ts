import { describe, expect, test } from "vitest";
import { displayLabel, moveOrderedIds, nextItemSort } from "./catalog-domain";
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
  protected: false,
  in_use: false,
  usage_count: 0,
  created_by: null,
  created_by_username: null,
  deactivated_at: null,
  deactivated_by: null,
  deactivated_by_username: null,
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
      item("other", 0, { is_other: true, protected: true }),
    ];
    expect(moveOrderedIds(rows, "b", "up")).toEqual(["b", "a"]);
    expect(moveOrderedIds(rows, "a", "up")).toEqual([]);
    expect(moveOrderedIds(rows, "b", "down")).toEqual([]);
    expect(moveOrderedIds(rows, "other", "up")).toEqual([]);
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
      rows: [
        item("a", 10),
        item("b", 20),
        item("other", 10000, { is_other: true, protected: true }),
      ],
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
