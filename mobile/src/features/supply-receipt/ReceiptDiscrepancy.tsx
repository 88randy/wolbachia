import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { ReceiptDiscrepancyChoices } from "./ReceiptDiscrepancyChoices.tsx";
import { createReceiptStyles } from "./styles.ts";
import type { M05Model } from "./use-m-05.ts";
function discrepancyEditor(model: M05Model) {
  return (kind: "missing" | "damaged" | "other", text: string) => {
    model.edit(
      "discrepancy",
      (eventId) => model.service.discrepancy(kind, text, eventId),
      (draft) => ({ ...draft, signature: null, discrepancy: { kind, text } }),
    );
  };
}

export function ReceiptDiscrepancy({ model }: { readonly model: M05Model }) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  const selected = model.state?.draft?.discrepancy;
  const edit = discrepancyEditor(model);
  return (
    <View style={styles.group}>
      <AppText variant="button">{t("mobile.supplyReceipt.discrepancy")}</AppText>
      <ReceiptDiscrepancyChoices
        selected={selected?.kind}
        disabled={isReceiptReadOnly(model)}
        onChange={(kind) => {
          edit(kind, selected?.text ?? "");
        }}
      />
      <AppText>{t("mobile.supplyReceipt.discrepancyText")}</AppText>
      <TextField
        label={t("mobile.supplyReceipt.discrepancyText")}
        value={selected?.text ?? ""}
        editable={!isReceiptReadOnly(model)}
        multiline
        onChangeText={(text) => {
          edit(selected?.kind ?? "other", text);
        }}
      />
      <AppText variant="caption">{t("mobile.supplyReceipt.discrepancyHint")}</AppText>
    </View>
  );
}
