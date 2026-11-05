import type { Schemas } from "@wolbachia/api-client";
import { polygonText } from "./geometry";
export function BlockGeometry({ block }: { block: Schemas["Block"] }) {
  return (
    <details>
      <summary>{block.current_version?.revision ?? 0}</summary>
      <pre>{polygonText(block.current_version?.geometry)}</pre>
    </details>
  );
}
