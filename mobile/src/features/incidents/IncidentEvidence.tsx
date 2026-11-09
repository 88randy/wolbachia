import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { IncidentPhoto } from "./IncidentPhoto.tsx";
import { IncidentEvidenceMinimum } from "./IncidentEvidenceMinimum.tsx";
import { IncidentEvidenceActions } from "./IncidentEvidenceActions.tsx";
import type { M12Model } from "./use-m-12.ts";
export function IncidentEvidence({ model }: { readonly model: M12Model }) {
  const t = useT(),
    draft = model.state?.draft;
  if (!draft) return null;
  return (
    <View>
      <AppText variant="bodyStrong">{t("mobile.incidents.evidence")}</AppText>
      <IncidentEvidenceMinimum draft={draft} />
      {draft.evidence.map((photo) => (
        <IncidentPhoto key={photo.id} fileRef={photo.fileRef} />
      ))}
      <IncidentEvidenceActions model={model} />
    </View>
  );
}
