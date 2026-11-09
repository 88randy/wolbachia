import { isReceiptReadOnly } from "./editing.ts";
import { spacing } from "@wolbachia/tokens";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { createReceiptStyles } from "./styles.ts";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptFooter({ model }: { readonly model: M05Model }) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  const insets = useSafeAreaInsets();
  const { draft, event } = model.state ?? { draft: null, event: null };
  if (!draft || event) return null;
  const hasSignature = draft.signature !== null;
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[2] }]}>
      {hasSignature ? null : (
        <AppText variant="caption">{t("mobile.supplyReceipt.signatureRequired")}</AppText>
      )}
      <Button
        label={t(model.isBusy ? "mobile.supplyReceipt.working" : "mobile.supplyReceipt.save")}
        disabled={isReceiptReadOnly(model) || !hasSignature}
        onPress={() => {
          void model.run(() => model.service.save(draft.eventId));
        }}
      />
    </View>
  );
}
