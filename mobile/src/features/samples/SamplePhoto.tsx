import { Image, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { SamplePhotoActions } from "./SamplePhotoActions.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SamplePhoto({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const hint =
    model.requiresPhoto === null
      ? "mobile.sample.photoUnknown"
      : model.requiresPhoto
        ? "mobile.sample.photoRequired"
        : "mobile.sample.photoOptional";
  return (
    <>
      <SectionTitle title={t("mobile.sample.photo")} />
      <AppText variant="body">{t(hint)}</AppText>
      {model.photoUri ? (
        <View className="overflow-hidden rounded-card bg-surface-muted">
          <Image
            source={{ uri: model.photoUri }}
            className="aspect-square w-full"
            accessibilityLabel={t("mobile.sample.photoPreview")}
          />
        </View>
      ) : null}
      <SamplePhotoActions model={model} />
    </>
  );
}
