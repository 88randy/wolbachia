import { useState } from "react";
import { TrainingCommandDialog } from "./TrainingCommandDialog";
import { CERTIFICATE_FIELDS } from "./training-fields";
import type { PersonContext } from "./person-context";
import type { TrainingScope } from "./training-query";
import { CertificateEditorEvidence } from "./CertificateEditorEvidence";
import { createCertification } from "./certification-command";
interface Props {
  scope: TrainingScope;
  context: PersonContext;
}
export function CertificateCreate({ scope, context }: Props) {
  const [isUploading, setUploading] = useState(false);
  return (
    <TrainingCommandDialog
      scope={scope}
      title="trainings.person.create"
      description="trainings.person.createHint"
      fields={CERTIFICATE_FIELDS}
      isBlocked={isUploading}
      renderBefore={(editor) => (
        <CertificateEditorEvidence scope={scope} editor={editor} onBusyChange={setUploading} />
      )}
      execute={async (draft, signal) => createCertification(scope, { context, draft, signal })}
    />
  );
}
