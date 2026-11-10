import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useInventoryContext } from "../use-inventory-context";
import type { LabelKind, LabelSize } from "./label-kinds";
import type { LabelItem } from "./label-payload";
import { labelItemsOptions } from "./label-query";

const SEARCH_DELAY_MS = 300;

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value]);
  return debounced;
}

/** Local filter for types whose endpoint has no search (paddles, motorcycles). */
function visibleItems(kind: LabelKind, items: readonly LabelItem[], search: string) {
  if (kind !== "paddles" && kind !== "motorcycles") return items;
  const needle = search.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    [item.code, item.caption ?? ""].some((text) => text.toLowerCase().includes(needle)),
  );
}

/** Ticked records survive searches; the sheet prints exactly these. */
function useTicked(items: readonly LabelItem[]) {
  const [selected, setSelected] = useState<readonly LabelItem[]>([]);
  const toggle = (item: LabelItem) => {
    setSelected((current) =>
      current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [...current, item],
    );
  };
  const tickVisible = () => {
    setSelected((current) => [
      ...current,
      ...items.filter((item) => !current.some((entry) => entry.id === item.id)),
    ]);
  };
  const clear = () => {
    setSelected([]);
  };
  return { selected, toggle, tickVisible, clear };
}

function useLabelItems(kind: LabelKind, search: string) {
  const scope = useInventoryContext();
  const debounced = useDebounced(search);
  const query = useQuery({
    ...labelItemsOptions(scope, { kind, search: debounced.trim() }),
    placeholderData: (previous) => previous,
  });
  return { query, items: visibleItems(kind, query.data?.items ?? [], search) };
}

/** State of the W19 screen: type, search, ticked records and label size. */
export function useLabelSheet(initial: LabelKind) {
  const [kind, setKind] = useState<LabelKind>(initial);
  const [search, setSearch] = useState("");
  const [size, setSize] = useState<LabelSize>("medium");
  const { query, items } = useLabelItems(kind, search);
  const ticked = useTicked(items);
  const chooseKind = (next: LabelKind) => {
    setKind(next);
    setSearch("");
    ticked.clear();
  };
  const total = query.data?.count ?? 0;
  return { kind, chooseKind, search, setSearch, size, setSize, items, total, query, ...ticked };
}
