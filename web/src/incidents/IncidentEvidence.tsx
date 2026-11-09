import { useTranslation } from "react-i18next";
import type { Incident, IncidentScope } from "./incidents-query";
import { useIncidentUpload } from "./use-incident-upload";
import { IncidentEvidenceInput } from "./IncidentEvidenceInput";
import { IncidentEvidenceStatus } from "./IncidentEvidenceStatus";
import { IncidentEvidenceUpload } from "./IncidentEvidenceUpload";
interface EvidenceProps {
  scope: IncidentScope;
  incident: Incident;
  isBlocked: boolean;
  onVerified: (id: string) => void;
}
export function IncidentEvidence({ scope, incident, isBlocked, onVerified }: EvidenceProps) {
  const { t } = useTranslation();
  const upload = useIncidentUpload(scope, { id: incident.id, onVerified });
  return (
    <section>
      {incident.action_prerequisites?.can_upload_evidence ? (
        <fieldset disabled={isBlocked || upload.isBusy}>
          <IncidentEvidenceInput upload={upload} />
          <IncidentEvidenceStatus upload={upload} />
          <IncidentEvidenceUpload upload={upload} isBlocked={isBlocked} />
        </fieldset>
      ) : (
        <p>{t("incidents.evidence.noPermission")}</p>
      )}
    </section>
  );
}
