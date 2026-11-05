import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { polygonText, parsePolygon } from "./geometry";
import { useGeographyWrite } from "./use-geography-write";
import type { GeographyScope } from "./use-w-15";
import { useRetryWindow } from "./use-retry-window";
export interface CreateBlockOptions {
  scope: GeographyScope;
  quadrant: string;
  proposal?: Schemas["BlockSuggestion"];
}
export function useCreateBlock({ scope, quadrant, proposal }: CreateBlockOptions) {
  const [code, setCode] = useState("");
  const [text, setText] = useState(() => polygonText(proposal?.geometry));
  const write = useGeographyWrite<Schemas["Block"]>();
  const geometry = parsePolygon(text);
  const [saved, setSaved] = useState<Schemas["Block"] | null>(null);
  const isWaiting = useRetryWindow(write.retryAt);
  const create = async () => {
    if (!geometry || !code.trim() || saved) return;
    const result = await write.execute((signal) =>
      scope.client.POST("/api/v1/blocks/", {
        body: { quadrant, code: code.trim(), geometry },
        signal,
      }),
    );
    if (result.kind === "saved") setSaved(result.value);
  };
  return {
    code,
    setCode,
    text,
    setText,
    write,
    saved,
    create,
    isDisabled: !geometry || !code.trim() || isWaiting,
  };
}
export type CreateBlock = ReturnType<typeof useCreateBlock>;
