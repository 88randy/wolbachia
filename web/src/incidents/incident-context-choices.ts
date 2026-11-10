import type { Schemas } from "@wolbachia/api-client";
type ContextPair = Schemas["IncidentContextOption"];
export function incidentContextValue(
  filters: Readonly<Record<string, string>>,
  activeCenter?: string,
) {
  const center = filters["center"];
  const quadrant = filters["quadrant"];
  return center || quadrant ? JSON.stringify([center ?? activeCenter, quadrant ?? null]) : "";
}
export function incidentContextChoices(
  pairs: ContextPair[],
  value: string,
  selectedContext: string,
) {
  const options = pairs.map((pair) => ({
    value: JSON.stringify([pair.center_id, pair.quadrant_id]),
    label: `${pair.center_code} · ${pair.center_name}${pair.quadrant_code ? ` · ${pair.quadrant_code}` : ""}`,
  }));
  if (value && !options.some((option) => option.value === value))
    options.unshift({ value, label: selectedContext });
  return options;
}
export function incidentContextPatch(pairs: ContextPair[], next: string) {
  const pair = pairs.find((pair) => JSON.stringify([pair.center_id, pair.quadrant_id]) === next);
  return { center: pair?.center_id, quadrant: pair?.quadrant_id ?? undefined, page: undefined };
}
