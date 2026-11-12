import { motorcycleLabel } from "../labels/label-records";
import { useRowLabels } from "../labels/use-row-labels";
import type { Motorcycle } from "./fleet-query";

/** Label printing of the motorcycle list: voided motorcycles have no label. */
export function useFleetLabels() {
  return useRowLabels<Motorcycle>({
    toRecord: (row, text) => (row.voided_at === null ? motorcycleLabel(row, text) : null),
    rowLabel: (row) => row.code,
  });
}
