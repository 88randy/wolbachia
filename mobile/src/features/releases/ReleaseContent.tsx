import { ReleaseCapture } from "./ReleaseCapture.tsx";
import { ReleaseEvidence } from "./ReleaseEvidence.tsx";
import { ReleaseFeedback } from "./ReleaseFeedback.tsx";
import { ReleaseGates } from "./ReleaseGates.tsx";
import { ReleaseLoading } from "./ReleaseLoading.tsx";
import { ReleaseChoices } from "./ReleaseChoices.tsx";
import { ReleaseBegin } from "./ReleaseBegin.tsx";
import { ReleaseStatus } from "./ReleaseStatus.tsx";
import { ReleaseRestart } from "./ReleaseRestart.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseContent({ model }: { readonly model: ReleaseViewModel }) {
  if (model.isLoading) return <ReleaseLoading />;
  return (
    <>
      <ReleaseFeedback model={model} />
      <ReleaseStatus model={model} />
      <ReleaseChoices model={model} />
      <ReleaseGates gates={model.gates} />
      <ReleaseRestart model={model} />
      {model.hasDraft ? <ReleaseCapture model={model} /> : <ReleaseBegin model={model} />}
      {model.hasDraft ? <ReleaseEvidence model={model} /> : null}
    </>
  );
}
