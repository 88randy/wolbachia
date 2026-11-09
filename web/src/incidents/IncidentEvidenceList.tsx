import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { IncidentEvidenceDownload } from "./IncidentEvidenceDownload";
import type { Incident, IncidentScope } from "./incidents-query";
export function IncidentEvidenceList({ scope, incident }: { scope: IncidentScope; incident: Incident }) {
 const { t } = useTranslation();
 return <Card title={t("incidents.evidence.title")}>
 {!incident.evidence.length && <p>{t("incidents.evidence.empty")}</p>}
 <ul>{incident.evidence.map(proof => <li key={proof.id}>
 {proof.id} · {t(proof.is_readable && proof.is_verified ? "incidents.evidence.verified" : "incidents.evidence.restricted")}
 {proof.is_readable && <IncidentEvidenceDownload scope={scope} id={proof.id} />}
 </li>)}</ul>
 </Card>;
}
