import type { Schemas } from "@wolbachia/api-client";
import type { WriteOutcome } from "./write-result";
import { SpacingWarnings } from "./SpacingWarnings";
interface Props {
  outcome: WriteOutcome<Schemas["PointWrite"]> | null;
  points: Schemas["SamplingPoint"][];
}
export function PointWriteWarnings({ outcome, points }: Props) {
  if (outcome?.kind !== "saved") return null;
  return (
    <SpacingWarnings
      warnings={outcome.value.spacing_warnings}
      points={[...points, outcome.value.point]}
    />
  );
}
