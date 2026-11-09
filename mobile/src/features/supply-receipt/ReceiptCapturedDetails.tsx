import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";

export function ReceiptCapturedDetails({ draft }: { readonly draft: ReceiptDraft }) {
  const t = useT();
  return (
    <View>
      {draft.discrepancy ? (
        <>
          <AppText variant="button">{t(`mobile.supplyReceipt.${draft.discrepancy.kind}`)}</AppText>
          <AppText selectable>{draft.discrepancy.text}</AppText>
        </>
      ) : null}
      {draft.signature ? <AppText>{t("mobile.supplyReceipt.signatureSaved")}</AppText> : null}
      {draft.evidence.length ? <AppText>{t("mobile.supplyReceipt.photoSaved")}</AppText> : null}
    </View>
  );
}
