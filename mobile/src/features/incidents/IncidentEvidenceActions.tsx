import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { IncidentUndoPhoto } from "./IncidentUndoPhoto.tsx";
import type { M12Model } from "./use-m-12.ts";
export function IncidentEvidenceActions({ model }: { readonly model: M12Model }) {
  const t = useT(),
    state = model.state;
  if (!state?.draft || state.event) return null;
  const id = state.draft.eventId;
  const disabled = model.isBusy || !state.ready || !state.canUpload;
  return (
    <View>
      {!state.canUpload ? <AppText>{t("mobile.incidents.uploadUnavailable")}</AppText> : null}
      <Button
        variant="outline"
        label={t("mobile.incidents.takePhoto")}
        disabled={disabled}
        onPress={() => {
          void model.run(() => model.service.photo(id));
        }}
      />
      <IncidentUndoPhoto model={model} />
    </View>
  );
}
