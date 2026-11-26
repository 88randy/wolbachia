import { Camera } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { IncidentUndoPhoto } from "./IncidentUndoPhoto.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentEvidenceActions({ model }: { readonly model: M12Model }) {
  const t = useT();
  const state = model.state;
  if (!state?.draft || state.event) return null;
  const id = state.draft.eventId;
  const disabled = model.isBusy || !state.ready || !state.canUpload;
  return (
    <>
      {!state.canUpload ? (
        <InfoNotice tone="warning" message={t("mobile.incidents.uploadUnavailable")} />
      ) : null}
      <SecondaryButton
        icon={Camera}
        label={t("mobile.incidents.takePhoto")}
        disabled={disabled}
        onPress={() => {
          void model.run(() => model.service.photo(id));
        }}
      />
      <IncidentUndoPhoto model={model} />
    </>
  );
}
