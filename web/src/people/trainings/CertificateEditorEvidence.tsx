import { CertificateEvidencePicker } from "./CertificateEvidencePicker";
import { splitValues } from "./training-input";
import type { TrainingScope } from "./training-query";
import type { useTrainingEditor } from "./use-training-editor";
interface Props {
  scope: TrainingScope;
  editor: ReturnType<typeof useTrainingEditor>;
  onBusyChange: (busy: boolean) => void;
}
export function CertificateEditorEvidence({ scope, editor, onBusyChange }: Props) {
  return (
    <CertificateEvidencePicker
      scope={scope}
      onBusyChange={onBusyChange}
      isBlocked={editor.draft.isLocked}
      onVerified={(id) => {
        const existing = splitValues(editor.draft.draft["evidence_ids"] ?? "");
        editor.draft.setField("evidence_ids", [...new Set([...existing, id])].join(", "));
      }}
    />
  );
}
