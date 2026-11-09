import { View } from "react-native";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { ReceiptInboxLink } from "./ReceiptInboxLink.tsx";
import { ReceiptBody } from "./ReceiptBody.tsx";
import { ReceiptFeedback } from "./ReceiptFeedback.tsx";
import { ReceiptFooter } from "./ReceiptFooter.tsx";
import { ReceiptStatus } from "./ReceiptStatus.tsx";
import { createReceiptStyles } from "./styles.ts";
import { useM05 } from "./use-m-05.ts";

/** P8 keeps the original signed observation separate from file transport and server outcomes. */
export function P8Screen() {
  const model = useM05();
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t("mobile.supplyReceipt.title")}
        subtitle={t("mobile.supplyReceipt.subtitle")}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReceiptFeedback model={model} />
        <ReceiptStatus
          event={model.state?.event ?? null}
          signaturePending={model.state?.signaturePending ?? false}
          review={model.state?.review ?? null}
        />
        <ReceiptBody model={model} />
        <ReceiptInboxLink model={model} />
      </AppScrollView>
      <ReceiptFooter model={model} />
    </View>
  );
}
