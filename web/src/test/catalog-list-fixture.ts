import type { CatalogItem } from "../catalogs/catalogs-query";
const ORDER_FIELDS = ["code", "label_es", "label_en", "sort", "created_at", "usage_count"] as const;
/** Synthetic server responses for the local harness/browser fixture, never production table filtering. */
export function catalogItemFixturePage(items: readonly CatalogItem[], path: string) {
  const url = new URL(path, "http://fixture.invalid");
  const query = url.searchParams;
  const active = query.get("is_active");
  const search = query.get("search")?.toLocaleLowerCase() ?? "";
  const matches = items.filter(
    (item) =>
      (active === null || String(item.is_active) === active) &&
      [item.code, item.label_es, item.label_en].some((label) =>
        label.toLocaleLowerCase().includes(search),
      ),
  );
  const ordered = orderItems(matches, query.get("ordering"));
  const page = Number(query.get("page") ?? "1");
  const size = Number(query.get("page_size") ?? "25");
  const offset = (page - 1) * size;
  url.searchParams.set("page", String(page + 1));
  return {
    count: matches.length,
    results: ordered.slice(offset, offset + size),
    next: offset + size < matches.length ? url.pathname + url.search : null,
    previous: null,
  };
}
function orderItems(items: CatalogItem[], ordering: string | null) {
  const field = ORDER_FIELDS.find((name) => name === ordering?.replace(/^-/, "")) ?? "sort";
  const direction = ordering?.startsWith("-") ? -1 : 1;
  return [...items].sort((left, right) => {
    const first = left[field];
    const second = right[field];
    const compared =
      typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second));
    return (
      Number(left.is_other) - Number(right.is_other) ||
      direction * compared ||
      left.code.localeCompare(right.code)
    );
  });
}
