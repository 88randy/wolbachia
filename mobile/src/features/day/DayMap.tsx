import { useState } from "react";
import type { MapFile } from "./map-coverage.ts";
import type { M06Model } from "./use-m-06.ts";
import { MissingMap } from "./MissingMap.tsx";
import { MapRenderer } from "./MapRenderer.tsx";
export function DayMap({ model }: { readonly model: M06Model }) {
  const [failedFiles, setFailedFiles] = useState<readonly MapFile[] | null>(null);
  const map = model.state?.map;
  if (map?.kind !== "ready" || map.files === failedFiles) return <MissingMap model={model} />;
  return (
    <MapRenderer
      files={map.files}
      rows={model.tasks}
      selected={model.selected}
      onSelect={(row) => {
        void model.select(row.task);
      }}
      onFailure={() => {
        setFailedFiles(map.files);
      }}
    />
  );
}
