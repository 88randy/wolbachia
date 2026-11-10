import { isReceiptReadOnly } from "./editing.ts";
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { ReceiptScanActions } from "./ReceiptScanActions.tsx";
import { ReceiptBarcodeScanner } from "./ReceiptBarcodeScanner.tsx";
import { createReceiptStyles } from "./styles.ts";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptScan({ model }: { readonly model: M05Model }) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  const [value, setValue] = useState("");
  return (
    <View style={styles.group}>
      <ReceiptBarcodeScanner model={model} />
      <AppText>{t("mobile.supplyReceipt.scanLabel")}</AppText>
      <TextField
        label={t("mobile.supplyReceipt.scanLabel")}
        value={value}
        onChangeText={setValue}
        editable={!isReceiptReadOnly(model)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AppText variant="caption">{t("mobile.supplyReceipt.scanHint")}</AppText>
      <ReceiptScanActions model={model} value={value} />
    </View>
  );
}
