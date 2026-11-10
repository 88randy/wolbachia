import { ReleaseView } from "../src/features/releases/ReleaseView.tsx";
import { useReleasePreviewModel } from "./release-preview-model.js";

/** Actual P18/P19 view and controls, supplied solely by an in-memory fixture. */
export function ReleasePreview({ isBlocked }) {
  const { model, previewHint } = useReleasePreviewModel(isBlocked);
  return (
    <div className="release-preview">
      {previewHint ? (
        <p className="preview-feedback" role="status">
          {previewHint}
        </p>
      ) : null}
      <ReleaseView model={model} />
    </div>
  );
}
