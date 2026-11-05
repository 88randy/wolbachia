import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { allPointsOptions } from "./geography-query";
import { parseLocation } from "./geometry";
import { useGeographyWrite } from "./use-geography-write";
import { useRetryWindow } from "./use-retry-window";
export function useCreatePoint(scope: GeographyScope, block: Schemas["Block"]) {
  const [input, setInput] = useState({ code: "", location: "" });
  const existing = useQuery(allPointsOptions(scope, block.quadrant));
  const location = parseLocation(input.location);
  const write = useGeographyWrite<Schemas["PointWrite"]>();
  const isWaiting = useRetryWindow(write.retryAt);
  const isSaved = write.outcome?.kind === "saved";
  const create = () => {
    if (location)
      void write.execute((signal) =>
        scope.client.POST("/api/v1/sampling-points/", {
          body: { block: block.id, code: input.code.trim(), location },
          signal,
        }),
      );
  };
  return {
    input,
    setInput,
    existing,
    write,
    isSaved,
    create,
    isDisabled: !location || !input.code.trim() || write.isBusy || isSaved || isWaiting,
  };
}
