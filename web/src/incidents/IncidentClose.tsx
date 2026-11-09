import { useVoidLimits } from "../void/use-void-limits";
import { normalizeReason } from "../void/count-characters";
import { useIncidentDraft } from "./use-incident-draft";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Card } from "../ui/Card";
import { canCloseIncident, verifiedIncidentEvidence } from "./incident-command";
import type { IncidentActionProps } from "./IncidentComment";
import type { IncidentScope } from "./incidents-query";
import { IncidentEvidence } from "./IncidentEvidence";
export function IncidentClose(props: IncidentActionProps & { scope: IncidentScope }) {
 const { t } = useTranslation();
 const limits = useVoidLimits();
 const draft = useIncidentDraft("close");
 const { value: reason, setValue: setReason } = draft;
 const [uploaded, setUploaded] = useState<string[]>([]);
 const ids = verifiedIncidentEvidence(props.incident, uploaded);
 const canClose = !props.isBlocked && canCloseIncident(props.incident, ids, { reason, limits });
 return <Card title={t("incidents.workspace.close")}>
 <p>{t("incidents.workspace.requiredEvidence", { count: props.incident.action_prerequisites?.close_evidence_min ?? props.incident.type_snapshot?.close_evidence_min })}</p>
 <TextField hint={draft.isRestored ? t("incidents.workspace.draftRestored") : undefined} trailing={draft.isRestored ? <Button variant="ghost" onClick={draft.discard}>{t("incidents.workspace.discardDraft")}</Button> : undefined} id="incident-close-reason" label={t("incidents.workspace.closeReason")} value={reason} maxLength={limits.maxLength} onChange={event => { setReason(event.target.value); }} />
 <IncidentEvidence scope={props.scope} incident={props.incident} isBlocked={props.isBlocked} onVerified={id => { setUploaded(previous => [...new Set([...previous, id])]); }} />
 {!canClose && <p>{t("incidents.workspace.closeBlocked")}</p>}
 <ConfirmDialog title={t("incidents.workspace.close")} consequence={t("incidents.workspace.closeConsequence")} actionLabel={t("incidents.workspace.close")} trigger={<Button aria-disabled={!canClose} loading={props.isBusy}>{t("incidents.workspace.close")}</Button>} onConfirm={() => { if (canClose) void props.submit({ action: "close", body: { expected_revision: props.incident.revision, reason: normalizeReason(reason), evidence_ids: ids } }); }} />
 </Card>;
}
