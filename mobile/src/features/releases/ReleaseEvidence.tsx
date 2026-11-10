import { Image } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ReleaseEvidenceActions } from "./ReleaseEvidenceActions.tsx";
import { createReleaseStyles } from "./styles.ts";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseEvidence({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const styles = useStyles(createReleaseStyles);
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  const hint =
    model.requiresEvidence === null
      ? "mobile.release.evidenceUnknown"
      : model.requiresEvidence
        ? "mobile.release.evidenceRequired"
        : "mobile.release.evidenceOptional";
  return (
    <Card>
      <AppText variant="button">{t("mobile.release.evidence")}</AppText>
      <AppText>{t(hint)}</AppText>
      <AppText isMonospace>{model.evidenceCount}</AppText>
      {model.photoUri ? (
        <Image
          source={{ uri: model.photoUri }}
          style={styles.photo}
          accessibilityLabel={t("mobile.release.photoPreview")}
        />
      ) : null}
      <ReleaseEvidenceActions model={model} disabled={disabled} />
    </Card>
  );
}
