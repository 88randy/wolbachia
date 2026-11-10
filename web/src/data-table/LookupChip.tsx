import type { LookupSource } from "../lookups/lookup-sources";
import { FilterChip } from "./FilterChip";
import { useLookupOptions } from "./use-lookup-options";

interface LookupChipProps {
  name: string;
  source: LookupSource;
  value: string;
  /** Shown until (or unless) the option's name is known. */
  fallback: string;
  onRemove?: () => void;
}

/** The chip of a picked option shows its name (from the cached first page), never the raw id. */
export function LookupChip({ name, source, value, fallback, onRemove }: LookupChipProps) {
  const query = useLookupOptions(source, "");
  const label = query.data?.find((option) => option.value === value)?.label ?? fallback;
  return <FilterChip name={name} value={label} onRemove={onRemove} />;
}
