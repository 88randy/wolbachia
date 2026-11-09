import type { ComponentProps } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import type { useIncidentDraft } from "./use-incident-draft";
import { IncidentDraftDiscard } from "./IncidentDraftDiscard";
interface DraftFieldProps extends Omit<
  ComponentProps<typeof TextField>,
  "label" | "value" | "onChange"
> {
  draft: ReturnType<typeof useIncidentDraft>;
  labelKey: MessageKey;
}
export function IncidentDraftField({ draft, labelKey, ...props }: DraftFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      {...props}
      label={t(labelKey)}
      value={draft.value}
      hint={draft.isRestored ? t("incidents.workspace.draftRestored") : undefined}
      trailing={draft.isRestored ? <IncidentDraftDiscard onDiscard={draft.discard} /> : undefined}
      onChange={(event) => {
        draft.setValue(event.target.value);
      }}
    />
  );
}
