import { useVoidLimits } from "../void/use-void-limits";
import { normalizeReason } from "../void/count-characters";
import { isIncidentReasonValid } from "./incident-command";
import { useIncidentDraft } from "./use-incident-draft";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { IncidentActionProps } from "./IncidentComment";
export function IncidentVoid({ incident, isBlocked, isBusy, submit }: IncidentActionProps) {
 const { t } = useTranslation();
 const limits = useVoidLimits();
 const draft = useIncidentDraft("void");
 const { value: reason, setValue: setReason } = draft;
 const isDependent = incident.action_prerequisites?.has_void_dependents !== false;
 const canVoid = !isBlocked && !isDependent && isIncidentReasonValid(reason, limits);
 return <section>
 <TextField hint={draft.isRestored ? t("incidents.workspace.draftRestored") : undefined} trailing={draft.isRestored ? <Button variant="ghost" onClick={draft.discard}>{t("incidents.workspace.discardDraft")}</Button> : undefined} id="incident-void-reason" label={t("incidents.workspace.voidReason")} value={reason} maxLength={limits.maxLength} onChange={event => { setReason(event.target.value); }} />
 <ConfirmDialog title={t("incidents.workspace.void")} consequence={t("incidents.workspace.voidConsequence")} actionLabel={t("incidents.workspace.void")} trigger={<Button variant="secondary" aria-disabled={!canVoid} loading={isBusy}>{t("incidents.workspace.void")}</Button>} onConfirm={() => { if (canVoid) void submit({ action: "void", body: { expected_revision: incident.revision, reason: normalizeReason(reason) } }); }} />
 {isDependent && <p>{t("incidents.workspace.voidBlocked")}</p>}
 </section>;
}
