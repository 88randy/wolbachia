import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { Incident, IncidentScope } from "./incidents-query";
import { useIncidentUpload } from "./use-incident-upload";
interface EvidenceProps { scope: IncidentScope; incident: Incident; isBlocked: boolean; onVerified: (id: string) => void }
function isUploadBlocked(upload: ReturnType<typeof useIncidentUpload>, isBlocked: boolean) {
 return isBlocked || !upload.proof || upload.isInvalid || Boolean(upload.proof.verifiedAt);
}
export function IncidentEvidence({ scope, incident, isBlocked, onVerified }: EvidenceProps) {
 const { t } = useTranslation();
 const upload = useIncidentUpload(scope, { id: incident.id, onVerified });
 return <section>
 {incident.action_prerequisites?.can_upload_evidence ? <fieldset disabled={isBlocked || upload.isBusy}>
 <label htmlFor="incident-evidence">{t("incidents.evidence.file")}</label>
 <input id="incident-evidence" type="file" accept="image/jpeg,image/png" onChange={event => { upload.select(event.target.files?.[0]); }} />
 <p>{t("incidents.evidence.hint")}</p>
 {upload.proof && <p>{upload.proof.file.name} · {t(upload.proof.verifiedAt ? "incidents.evidence.verified" : "incidents.evidence.pending")}</p>}
 {upload.isInvalid && <p role="alert">{t("incidents.evidence.invalid")}</p>}
 {upload.hasFailed && <p role="alert">{t("incidents.evidence.failed")}</p>}
 <Button aria-disabled={isUploadBlocked(upload, isBlocked)} loading={upload.isBusy} onClick={() => { void upload.upload(); }}>{t("incidents.evidence.upload")}</Button>
 </fieldset> : <p>{t("incidents.evidence.noPermission")}</p>}
 </section>;
}
