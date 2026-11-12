import type { TableController } from "../data-table/table-types";
import { FleetFilters } from "./FleetFilters";
import type { Motorcycle } from "./fleet-query";
import { useFleetLabels } from "./use-fleet-labels";

interface Props {
  controller: TableController;
  counts: Readonly<Record<string, number>> | undefined;
  rows: readonly Motorcycle[];
}

/** The fleet list toolbar: filters, status counts and "Imprimir etiquetas de esta página". */
export function FleetListFilters({ controller, counts, rows }: Props) {
  const labels = useFleetLabels();
  return (
    <FleetFilters controller={controller} quickCounts={counts} actions={labels.pageAction(rows)} />
  );
}
