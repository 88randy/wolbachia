import { SampleChoices } from "./SampleChoices.tsx";
import type { SampleViewModel } from "./view-model.ts";

function SourceSelection({ model }: { readonly model: SampleViewModel }) {
  return (
    <SampleChoices
      labelKey="mobile.sample.source"
      emptyKey="mobile.sample.noSources"
      options={model.sources}
      selected={model.selectedSource}
      disabled={model.isBusy}
      onSelect={model.selectSource}
    />
  );
}
export function SampleSelection({ model }: { readonly model: SampleViewModel }) {
  if (!model.hasDraft) return <SourceSelection model={model} />;
  if (model.status !== "draft") return null;
  const disabled = model.isBusy || !model.canEdit;
  return (
    <>
      <SampleChoices
        labelKey="mobile.sample.origin"
        emptyKey="mobile.sample.noOrigins"
        options={model.origins}
        selected={model.selectedOrigin}
        disabled={disabled}
        onSelect={model.selectOrigin}
      />
      <SampleChoices
        labelKey="mobile.sample.method"
        emptyKey="mobile.sample.noMethods"
        options={model.methods}
        selected={model.selectedMethod}
        disabled={disabled}
        onSelect={model.selectMethod}
      />
    </>
  );
}
