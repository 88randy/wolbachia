import { Image, View } from "react-native";
import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { createIncidentStyles } from "./styles.ts";

export function IncidentPhoto({ fileRef }: { readonly fileRef: string }) {
  const t = useT(),
    styles = useStyles(createIncidentStyles);
  const [hasFailed, setFailed] = useState(false);
  return (
    <View>
      <Image
        source={{ uri: fileRef }}
        style={styles.photo}
        resizeMode="contain"
        accessible
        accessibilityLabel={t("mobile.incidents.photoPreview")}
        onError={() => {
          setFailed(true);
        }}
      />
      {hasFailed ? (
        <Notice tone="warning" icon="alert" message={t("mobile.incidents.previewUnavailable")} />
      ) : null}
    </View>
  );
}
