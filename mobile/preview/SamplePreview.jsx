import { SampleView } from "../src/features/samples/SampleView.tsx";
import { useSamplePreviewModel } from "./sample-preview-model.js";

/** The actual P20 view receives only a bounded, synthetic, in-memory model. */
export function SamplePreview() {
  const { model, previewHint } = useSamplePreviewModel();
  return (
    <div className="release-preview">
      {previewHint ? (
        <p className="preview-feedback" role="status">
          {previewHint}
        </p>
      ) : null}
      <SampleView model={model} />
    </div>
  );
}
