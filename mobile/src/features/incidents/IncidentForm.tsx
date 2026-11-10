import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { IncidentDescription } from "./IncidentDescription.tsx";
import { IncidentEvidence } from "./IncidentEvidence.tsx";
import { IncidentTypePicker } from "./IncidentTypePicker.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentForm({ model }: { readonly model: M12Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const disabled = model.isBusy || !model.state?.ready || model.state.event !== null;
  return (
    <>
      {draft.kind === "report" ? <IncidentTypePicker model={model} /> : null}
      <IncidentDescription
        key={draft.eventId}
        value={draft.description}
        isRequired={draft.kind === "report"}
        isSubmitted={model.submittedId === draft.eventId}
        disabled={disabled}
        onChange={model.editDescription}
      />
      <IncidentEvidence model={model} />
      {draft.gps ? null : <InfoNotice tone="info" message={t("mobile.incidents.noGps")} />}
    </>
  );
}
