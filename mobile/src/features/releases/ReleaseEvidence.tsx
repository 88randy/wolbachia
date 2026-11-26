import { Image, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { ReleaseEvidenceActions } from "./ReleaseEvidenceActions.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseEvidence({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  const hint =
    model.requiresEvidence === null
      ? "mobile.release.evidenceUnknown"
      : model.requiresEvidence
        ? "mobile.release.evidenceRequired"
        : "mobile.release.evidenceOptional";
  return (
    <>
      <SectionTitle title={t("courier.flow.release.photoTitle")} />
      <AppText variant="body">{t(hint)}</AppText>
      {model.photoUri ? (
        <View className="overflow-hidden rounded-card bg-surface-muted">
          <Image
            source={{ uri: model.photoUri }}
            className="aspect-square w-full"
            accessibilityLabel={t("mobile.release.photoPreview")}
          />
        </View>
      ) : null}
      <ReleaseEvidenceActions model={model} disabled={disabled} />
    </>
  );
}
