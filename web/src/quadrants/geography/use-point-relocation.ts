import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { parseLocation } from "./geometry";
import { allPointsOptions } from "./geography-query";
import { useGeographyWrite } from "./use-geography-write";
import { usePointRefresh } from "./use-point-refresh";
import type { GeographyScope } from "./use-w-15";
import { useRetryWindow } from "./use-retry-window";
export interface RelocationOptions {
  scope: GeographyScope;
  point: Schemas["SamplingPoint"];
  quadrant: string;
}
export function usePointRelocation({ scope, point, quadrant }: RelocationOptions) {
  const [text, setText] = useState(point.current_version?.location.join(",") ?? "");
  const [current, setCurrent] = useState(point.current_version);
  const location = parseLocation(text);
  const write = useGeographyWrite<Schemas["PointWrite"]>();
  const existing = useQuery(allPointsOptions(scope, quadrant));
  const refreshed = usePointRefresh(scope, point.id, (updated) => {
    setCurrent(updated.current_version);
  });
  const isWaiting = useRetryWindow(write.retryAt);
  return {
    text,
    setText,
    current,
    write,
    existing,
    ...refreshed,
    send: () => sendRelocation({ location, current, write, scope, point, setCurrent }),
    isDisabled: !location || !current || current.is_retired || write.isBusy || isWaiting,
  };
}
export type PointRelocation = ReturnType<typeof usePointRelocation>;

interface SendOptions {
  location: number[] | null;
  current: Schemas["PointVersion"] | null;
  write: ReturnType<typeof useGeographyWrite<Schemas["PointWrite"]>>;
  scope: GeographyScope;
  point: Schemas["SamplingPoint"];
  setCurrent: React.Dispatch<React.SetStateAction<Schemas["PointVersion"] | null>>;
}
async function sendRelocation({ location, current, write, scope, point, setCurrent }: SendOptions) {
  if (!location || !current || current.is_retired) return;
  const body = { location, expected_revision: current.version };
  const result = await write.execute((signal) =>
    scope.client.POST("/api/v1/sampling-points/{id}/versions/", {
      params: { path: { id: point.id } },
      body,
      signal,
    }),
  );
  if (result.kind === "saved") setCurrent(result.value.point.current_version);
}
