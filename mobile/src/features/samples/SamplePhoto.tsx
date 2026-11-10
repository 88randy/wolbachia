import { Image } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { SamplePhotoActions } from "./SamplePhotoActions.tsx";
import { createSampleStyles } from "./styles.ts";
import type { SampleViewModel } from "./view-model.ts";

export function SamplePhoto({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const styles = useStyles(createSampleStyles);
  const hint =
    model.requiresPhoto === null
      ? "mobile.sample.photoUnknown"
      : model.requiresPhoto
        ? "mobile.sample.photoRequired"
        : "mobile.sample.photoOptional";
  return (
    <Card>
      <AppText variant="bodyStrong">{t("mobile.sample.photo")}</AppText>
      <AppText>{t(hint)}</AppText>
      <AppText isMonospace>{model.evidenceCount}</AppText>
      {model.photoUri ? (
        <Image
          source={{ uri: model.photoUri }}
          style={styles.photo}
          accessibilityLabel={t("mobile.sample.photoPreview")}
        />
      ) : null}
      <SamplePhotoActions model={model} />
    </Card>
  );
}
