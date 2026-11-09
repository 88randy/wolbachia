import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ReceiptLines } from "./ReceiptLines.tsx";
import { ReceiptReference } from "./ReceiptReference.tsx";
import { ReceiptScan } from "./ReceiptScan.tsx";
import { ReceiptDiscrepancy } from "./ReceiptDiscrepancy.tsx";
import { ReceiptEvidence } from "./ReceiptEvidence.tsx";
import { ReceiptCapturedDetails } from "./ReceiptCapturedDetails.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptForm({ model }: { readonly model: M05Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const isSaved = model.state?.event !== null;
  return (
    <View>
      <ReceiptReference label={t("mobile.supplyReceipt.assignment")} value={draft.assignmentId} />
      <ReceiptReference label={t("mobile.supplyReceipt.release")} value={draft.releaseId} />
      <AppText variant="caption">{t("mobile.supplyReceipt.declaredUnits")}</AppText>
      <ReceiptLines model={model} />
      {isSaved ? null : <ReceiptScan key={draft.eventId} model={model} />}
      {isSaved ? null : <ReceiptDiscrepancy model={model} />}
      {isSaved ? null : <ReceiptEvidence model={model} />}
      {isSaved ? <ReceiptCapturedDetails draft={draft} /> : null}
    </View>
  );
}
