import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { IncidentDescription } from "./IncidentDescription.tsx";
import { IncidentTypePicker } from "./IncidentTypePicker.tsx";
import { IncidentEvidence } from "./IncidentEvidence.tsx";
import type { M12Model } from "./use-m-12.ts";
import { useT } from "../../i18n/I18nProvider.tsx";

export function IncidentForm({ model }: { readonly model: M12Model }) {
  const t = useT(),
    draft = model.state?.draft;
  if (!draft) return null;
  const disabled = model.isBusy || !model.state?.ready || model.state.event !== null;
  return (
    <Card>
      {draft.kind === "report" ? <IncidentTypePicker model={model} /> : null}
      <IncidentDescription
        key={draft.eventId}
        value={draft.description}
        isRequired={draft.kind === "report"}
        isSubmitted={model.submittedId === draft.eventId}
        disabled={disabled}
        onChange={model.editDescription}
      />
      <AppText variant="caption">{t("mobile.incidents.originalTime")}</AppText>
      <AppText variant="caption" isMonospace>
        {draft.deviceTime}
      </AppText>
      <AppText variant="caption">
        {t(draft.gps ? "mobile.incidents.gpsCaptured" : "mobile.incidents.noGps")}
      </AppText>
      <IncidentEvidence model={model} />
    </Card>
  );
}
