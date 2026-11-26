import { useMemo } from "react";
import { View } from "react-native";
import { MapView } from "../../maps/MapView.tsx";
import type { MapPoint, MapZone } from "../../maps/map-types.ts";
import { useOwnTrack } from "../track/use-own-track.ts";
import type { useM06 } from "./use-m-06.ts";
import { useStartTask } from "./use-start-task.ts";

interface Props {
  readonly model: ReturnType<typeof useM06>;
  readonly points: readonly MapPoint[];
  readonly zones: readonly MapZone[];
}

/** P10's map: route points, zones and the courier's own day track. */
export function P10Map({ model, points, zones }: Props) {
  const start = useStartTask();
  const track = useOwnTrack();
  const lines = useMemo(() => [track], [track]);
  const taskOf = (id: string) => model.tasks.find((candidate) => candidate.task.id === id)?.task;
  return (
    <View className="flex-1">
      <MapView
        points={points}
        zones={zones}
        lines={lines}
        selectedId={model.selected?.task.id ?? null}
        onStart={(id) => {
          const task = taskOf(id);
          if (task !== undefined) start(task);
        }}
        onSelectPoint={(id) => {
          const task = taskOf(id);
          if (task !== undefined) void model.select(task);
        }}
      />
    </View>
  );
}
