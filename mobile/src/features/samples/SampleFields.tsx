import { SampleField } from "./SampleField.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleFields({ model }: { readonly model: SampleViewModel }) {
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  return (
    <>
      <SampleField
        labelKey="mobile.sample.code"
        hintKey="mobile.sample.codeHint"
        errorKey={model.codeErrorKey}
        value={model.code}
        disabled={disabled}
        onChange={model.changeCode}
        onBlur={model.blurFields}
      />
      {model.isOther ? (
        <SampleField
          labelKey="mobile.sample.otherText"
          hintKey="mobile.sample.otherHint"
          errorKey={model.otherErrorKey}
          value={model.otherText}
          disabled={disabled}
          multiline
          onChange={model.changeOtherText}
          onBlur={model.blurFields}
        />
      ) : null}
    </>
  );
}
