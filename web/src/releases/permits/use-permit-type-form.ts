import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../../api/ApiClientProvider";
import { EMPTY_TYPE_DRAFT, typeBody, validateType } from "./permit-type-draft";
import type { PermitTypeDraft, PermitTypeErrors } from "./permit-type-draft";
import { usePermitSubmit } from "./use-permit-submit";

/** Draft in memory only; only an explicit submit sends a write, and a failure keeps the draft. */
export function usePermitTypeForm(onCreated: () => void) {
  const client = useApiClient();
  const submit = usePermitSubmit(onCreated, "permits.typeForm.failure");
  const [draft, setDraft] = useState(EMPTY_TYPE_DRAFT);
  const [found, setFound] = useState<PermitTypeErrors>({});
  const errors: PermitTypeErrors = submit.isDuplicate
    ? { ...found, code: "permits.typeForm.duplicate" }
    : found;
  const hasErrors = Object.keys(errors).length > 0;
  const alert: MessageKey | undefined =
    submit.failure ?? (hasErrors ? "permits.typeForm.invalid" : undefined);
  const send = (event: SyntheticEvent) => {
    event.preventDefault();
    const next = validateType(draft);
    setFound(next);
    if (Object.keys(next).length > 0) return;
    submit.run((guard) =>
      client.POST("/api/v1/permit-types/", { body: typeBody(draft), signal: guard.signal }),
    );
  };
  const change = (field: keyof PermitTypeDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
  return { draft, errors, alert, isBusy: submit.isBusy, submit: send, change };
}
