import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { FuelReceiptPreview } from "./FuelReceiptPreview.tsx";
import type { M11Model } from "./use-m-11.ts";
import type { FuelDraft } from "./types.ts";

function receiptHintKey(draft: FuelDraft, isSaved: boolean) {
  if (isSaved) return draft.receipt ? "mobile.fuel.receiptSaved" : "mobile.fuel.noReceiptSaved";
  return draft.receipt ? "mobile.fuel.receiptCheck" : "mobile.fuel.noReceipt";
}

/** Retake never clears the previous durable receipt while camera or storage can fail. */
export function FuelReceipt({ model }: { readonly model: M11Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const isSaved = model.state?.event !== null;
  return (
    <Card>
      <AppText variant="bodyStrong">{t("mobile.fuel.receipt")}</AppText>
      {draft.receipt ? (
        <FuelReceiptPreview key={draft.receipt.id} fileRef={draft.receipt.fileRef} />
      ) : null}
      <AppText>{t(receiptHintKey(draft, isSaved))}</AppText>
      {isSaved ? null : (
        <View>
          <Button
            variant="outline"
            label={t(draft.receipt ? "mobile.fuel.retake" : "mobile.fuel.takePhoto")}
            disabled={model.isBusy || !model.state?.ready}
            onPress={() => {
              void model.run(() => model.service.photo(draft.eventId));
            }}
          />
        </View>
      )}
    </Card>
  );
}
