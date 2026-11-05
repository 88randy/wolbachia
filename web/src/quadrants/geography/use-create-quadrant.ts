import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { parsePolygon } from "./geometry";
import { useGeographyWrite } from "./use-geography-write";
import { useRetryWindow } from "./use-retry-window";
export function useCreateQuadrant(scope: GeographyScope, onClose: () => void) {
  const [code, setCode] = useState("");
  const [center, setCenter] = useState("");
  const [text, setText] = useState("");
  const geometry = parsePolygon(text);
  const write = useGeographyWrite<Schemas["Quadrant"]>();
  const isWaiting = useRetryWindow(write.retryAt);
  const create = async () => {
    if (!geometry || !scope.canCreateQuadrant) return;
    const result = await write.execute((signal) =>
      scope.client.POST("/api/v1/quadrants/", {
        body: { code: code.trim(), center: center.trim(), geometry },
        signal,
      }),
    );
    if (result.kind === "saved") onClose();
  };
  const isDisabled = !geometry || !code.trim() || !center.trim() || write.isBusy || isWaiting;
  return { code, setCode, center, setCenter, text, setText, write, create, isDisabled };
}
export type CreateQuadrant = ReturnType<typeof useCreateQuadrant>;
