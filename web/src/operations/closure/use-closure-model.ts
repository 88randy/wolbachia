import { useQuery } from "@tanstack/react-query";
import type { GeographyScope } from "../../quadrants/geography/use-w-15";
import { readinessOptions } from "./closure-query";
import { useClosureWrite } from "./use-closure-write";
import type { Quadrant } from "./closure-policy";
export interface ClosureProps {
  scope: GeographyScope;
  quadrant: Quadrant;
  refreshQuadrant: () => void;
  isRecordFetching: boolean;
}
export function useClosureModel(props: ClosureProps) {
  const query = useQuery(readinessOptions(props.scope, props.quadrant.id));
  const refresh = () => {
    props.refreshQuadrant();
    void query.refetch();
  };
  const write = useClosureWrite(props.scope, refresh);
  return { ...props, query, refresh, write };
}
export type ClosureModel = ReturnType<typeof useClosureModel>;
