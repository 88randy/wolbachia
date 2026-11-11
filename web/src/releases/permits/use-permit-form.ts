import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { initialDraft, validatePermit, versionBody } from "./permit-draft";
import type { PermitDraft, PermitErrors } from "./permit-draft";
import { postPermit, postPermitVersion } from "./permit-requests";
import type { Call } from "./permit-requests";
import { permitFormChoicesOptions } from "./permits-query";
import type { Permit } from "./permits-query";
import { usePermitDocumentUpload } from "./use-permit-document-upload";
import { usePermitSubmit } from "./use-permit-submit";
import { useOrganizationTimeZone } from "../../format/use-time-zone";

function useDraft(permit: Permit | undefined, timeZone: string) {
  const [draft, setDraft] = useState(() => initialDraft(permit, timeZone));
  const change = (field: keyof PermitDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
  return { draft, change };
}

/** Found errors plus a duplicate code from the server; the alert says what to do next. */
function useFormErrors(isDuplicate: boolean, failure: MessageKey | undefined) {
  const [found, setFound] = useState<PermitErrors>({});
  const errors: PermitErrors = isDuplicate ? { ...found, code: "permits.form.duplicate" } : found;
  const hasErrors = Object.keys(errors).length > 0;
  return { errors, setFound, alert: failure ?? (hasErrors ? "permits.form.invalid" : undefined) };
}

function sendPermit(call: Call, draft: PermitDraft, permit: Permit | undefined) {
  if (permit) return postPermitVersion(call, permit);
  return postPermit(call, { code: draft.code.trim(), quadrant: draft.quadrant });
}

/**
 * Create a permit, or append a version to `permit`. The draft lives in memory only; a failure keeps
 * it and only an explicit submit sends a write. Dates are typed in the organization's zone.
 */
export function usePermitForm(permit: Permit | undefined, onSaved: () => void) {
  const client = useApiClient();
  const timeZone = useOrganizationTimeZone();
  const choices = useQuery(permitFormChoicesOptions(client, useSessionIdentity()));
  const document = usePermitDocumentUpload();
  const submit = usePermitSubmit(onSaved, "permits.form.conflict");
  const { draft, change } = useDraft(permit, timeZone);
  const { errors, setFound, alert } = useFormErrors(submit.isDuplicate, submit.failure);
  const send = (event: SyntheticEvent) => {
    event.preventDefault();
    const context = { timeZone, isVersion: permit !== undefined, hasDocument: !!document.uploadId };
    const next = validatePermit(draft, context);
    setFound(next);
    if (Object.keys(next).length > 0 || !document.uploadId) return;
    const body = versionBody(draft, timeZone, document.uploadId);
    submit.run((guard) => sendPermit({ client, body, signal: guard.signal }, draft, permit));
  };
  return {
    draft,
    errors,
    alert,
    document,
    choices: choices.data,
    isBusy: submit.isBusy,
    send,
    change,
  };
}
