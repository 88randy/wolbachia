import { MapMarker } from "./MapMarker.tsx";
import { mapTasks } from "./domain.ts";
import type { DayTask } from "./domain.ts";
interface Props {
  readonly rows: readonly DayTask[];
  readonly selected: DayTask | null;
  readonly onSelect: (row: DayTask) => void;
}
export function MapMarkers({ rows, selected, onSelect }: Props) {
  return (
    <>
      {mapTasks(rows).map((row) => (
        <MapMarker
          key={row.task.id}
          row={row}
          isSelected={selected?.task.id === row.task.id}
          onSelect={() => {
            onSelect(row);
          }}
        />
      ))}
    </>
  );
}
