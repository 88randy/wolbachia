import { useIncidentDraft } from "./use-incident-draft";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import type { Incident } from "./incidents-query";
import type { IncidentCommand } from "./incident-command";
export interface IncidentActionProps {
 incident: Incident; isBlocked: boolean; isBusy: boolean;
 submit: (command: IncidentCommand) => Promise<boolean>;
}
export function IncidentComment({ incident, isBlocked, isBusy, submit }: IncidentActionProps) {
 const { t } = useTranslation();
 const draft = useIncidentDraft("comment");
 const { value: text, setValue: setText } = draft;
 if (!incident.action_permissions.comment) return null;
 return <form onSubmit={event => { event.preventDefault();
 if (!isBlocked && text.trim()) void submit({ action: "comment", body: { expected_revision: incident.revision, text: text.trim() } }).then(saved => { if (saved) setText(""); });
 }}>
 <TextField hint={draft.isRestored ? t("incidents.workspace.draftRestored") : undefined} trailing={draft.isRestored ? <Button variant="ghost" onClick={draft.discard}>{t("incidents.workspace.discardDraft")}</Button> : undefined} disabled={isBusy} id="incident-comment" label={t("incidents.workspace.comment")} value={text} maxLength={4000} onChange={event => { setText(event.target.value); }} />
 <Button type="submit" aria-disabled={isBlocked || !text.trim()} loading={isBusy}>{t("incidents.workspace.sendComment")}</Button>
 </form>;
}
