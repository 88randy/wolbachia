import { ReleaseCapture } from "./ReleaseCapture.tsx";
import { ReleaseEvidence } from "./ReleaseEvidence.tsx";
import { ReleaseFeedback } from "./ReleaseFeedback.tsx";
import { ReleaseGates } from "./ReleaseGates.tsx";
import { ReleaseLoading } from "./ReleaseLoading.tsx";
import { ReleaseChoices } from "./ReleaseChoices.tsx";
import { ReleaseBegin } from "./ReleaseBegin.tsx";
import { ReleaseReferences } from "./ReleaseReferences.tsx";
import { ReleaseStatus } from "./ReleaseStatus.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseContent({ model }: { readonly model: ReleaseViewModel }) {
  if (model.isLoading) return <ReleaseLoading />;
  return (
    <>
      <ReleaseFeedback model={model} />
      <ReleaseStatus model={model} />
      <ReleaseChoices model={model} />
      <ReleaseReferences refs={model.refs} />
      <ReleaseGates gates={model.gates} />
      {model.hasDraft ? <ReleaseCapture model={model} /> : <ReleaseBegin model={model} />}
      {model.hasDraft ? <ReleaseEvidence model={model} /> : null}
    </>
  );
}
