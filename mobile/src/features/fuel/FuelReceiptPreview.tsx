import { Image, View } from "react-native";
import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { createFuelStyles } from "./styles.ts";

export function FuelReceiptPreview({ fileRef }: { readonly fileRef: string }) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  const [hasFailed, setFailed] = useState(false);
  return (
    <View>
      <Image
        source={{ uri: fileRef }}
        style={styles.photo}
        resizeMode="contain"
        accessible
        accessibilityLabel={t("mobile.fuel.receiptPreview")}
        onError={() => {
          setFailed(true);
        }}
      />
      {hasFailed ? (
        <Notice tone="warning" icon="alert" message={t("mobile.fuel.previewUnavailable")} />
      ) : null}
    </View>
  );
}
