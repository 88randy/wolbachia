import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LABEL_KIND_SPECS, OVITRAP_LABEL_MINT_PERMISSION } from "../../labels/label-kinds";
import type { LabelKind } from "../../labels/label-kinds";
import type { LabelSource } from "../../labels/label-records";
import { useCan } from "../../session/use-can";
import { useInventoryContext } from "../use-inventory-context";
import { labelItemsOptions } from "./label-query";
import { unplacedOvitrapLabelsOptions } from "./ovitrap-label-query";
import { useNewOvitrapLabels } from "./use-new-ovitrap-labels";

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

/** Registered stickers with no ovitrap yet (people with the label permission only), by code. */
function useUnplacedLabels(isEnabled: boolean, search: string): LabelSource[] {
  const scope = useInventoryContext();
  const query = useQuery(unplacedOvitrapLabelsOptions(scope, isEnabled));
  if (!isEnabled) return [];
  const needle = search.trim().toLowerCase();
  return (query.data ?? [])
    .filter((row) => !needle || row.code.toLowerCase().includes(needle))
    .map((row): LabelSource => ({ kind: "ovitrap_label", row }));
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

/** The records of one kind: placed ones from the server, plus the unplaced stickers to mint. */
function useKindSources(kind: LabelKind, search: string, debounced: string) {
  const scope = useInventoryContext();
  const can = useCan();
  // Who may only register stickers sees the unplaced ones, not the placed ovitraps.
  const canReadPlaced = can(LABEL_KIND_SPECS[kind].permission);
  const placed = labelItemsOptions(scope, { kind, search: debounced.trim() });
  const query = useQuery({ ...placed, enabled: placed.enabled && canReadPlaced });
  const canMint = can(OVITRAP_LABEL_MINT_PERMISSION) && kind === "ovitrap";
  const unplaced = useUnplacedLabels(canMint, search);
  const items = [...unplaced, ...visibleSources(kind, query.data?.sources ?? [], search)];
  return { query, items, canMint, canReadPlaced };
}

/** State of the W19 screen: kind, search and the ticked records. */
export function useLabelPicker(start: LabelPickerStart) {
  const [kind, setKind] = useState<LabelKind>(start.kind);
  const [search, setSearch] = useState(start.code ?? "");
  const sources = useKindSources(kind, search, useDebounced(search));
  const ticked = useTicked(sources.items);
  const newLabels = useNewOvitrapLabels(ticked.add);
  useDeepLinkTick(start, ticked.add);
  const chooseKind = (next: LabelKind) => {
    setKind(next);
    setSearch("");
    ticked.clear();
  };
  const total = sources.query.data?.count ?? 0;
  return { kind, chooseKind, search, setSearch, total, newLabels, ...sources, ...ticked };
}
