import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LabelKind } from "../../labels/label-kinds";
import type { LabelSource } from "../../labels/label-records";
import { useInventoryContext } from "../use-inventory-context";
import { labelItemsOptions } from "./label-query";

const SEARCH_DELAY_MS = 300;

/** Where the screen starts: a kind, and optionally the record a deep link asked for. */
export interface LabelPickerStart {
  kind: LabelKind;
  /** Human code of a record to tick as soon as it loads. */
  code?: string | undefined;
}

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

const idOf = (source: LabelSource) => source.row.id;
const codeOf = (source: LabelSource) => source.row.code;

/** Local filter for kinds whose endpoint has no search (paddles, motorcycles). */
function visibleSources(kind: LabelKind, loaded: readonly LabelSource[], search: string) {
  // While another kind loads, the query may still hold the previous kind's rows: never show them.
  const sources = loaded.filter((source) => source.kind === kind);
  if (kind !== "paddle" && kind !== "motorcycle") return sources;
  const needle = search.trim().toLowerCase();
  if (!needle) return sources;
  return sources.filter((source) => codeOf(source).toLowerCase().includes(needle));
}

/** Ticked records survive searches; the dialog prints exactly these. */
function useTicked(sources: readonly LabelSource[]) {
  const [selected, setSelected] = useState<readonly LabelSource[]>([]);
  const toggle = (source: LabelSource) => {
    setSelected((current) =>
      current.some((entry) => idOf(entry) === idOf(source))
        ? current.filter((entry) => idOf(entry) !== idOf(source))
        : [...current, source],
    );
  };
  const add = (added: readonly LabelSource[]) => {
    setSelected((current) => [
      ...current,
      ...added.filter((source) => !current.some((entry) => idOf(entry) === idOf(source))),
    ]);
  };
  const tickVisible = () => {
    add(sources);
  };
  const clear = () => {
    setSelected([]);
  };
  return { selected, toggle, add, tickVisible, clear };
}

/** The record a deep link asked for, ticked once when it arrives. */
function useDeepLinkTick(start: LabelPickerStart, add: (sources: readonly LabelSource[]) => void) {
  const scope = useInventoryContext();
  const [isDone, setDone] = useState(start.code === undefined);
  const query = useQuery({
    ...labelItemsOptions(scope, { kind: start.kind, search: "", code: start.code ?? "" }),
    enabled: !isDone,
  });
  const found = query.data?.sources;
  useEffect(() => {
    if (isDone || found === undefined) return;
    add(found);
    setDone(true);
  }, [isDone, found, add]);
}

/** State of the W19 screen: kind, search and the ticked records. */
export function useLabelPicker(start: LabelPickerStart) {
  const scope = useInventoryContext();
  const [kind, setKind] = useState<LabelKind>(start.kind);
  const [search, setSearch] = useState(start.code ?? "");
  const debounced = useDebounced(search);
  const query = useQuery(labelItemsOptions(scope, { kind, search: debounced.trim() }));
  const items = visibleSources(kind, query.data?.sources ?? [], search);
  const ticked = useTicked(items);
  useDeepLinkTick(start, ticked.add);
  const chooseKind = (next: LabelKind) => {
    setKind(next);
    setSearch("");
    ticked.clear();
  };
  return {
    kind,
    chooseKind,
    search,
    setSearch,
    items,
    total: query.data?.count ?? 0,
    query,
    ...ticked,
  };
}
