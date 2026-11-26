import { Camera } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
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
  const takePhoto = () => {
    void model.run(() => model.service.photo(draft.eventId));
  };
  const isDisabled = model.isBusy || !model.state?.ready;
  const Button = SecondaryButton;
  return (
    <>
      <SectionTitle title={t("mobile.fuel.receipt")} />
      {draft.receipt ? (
        <FuelReceiptPreview key={draft.receipt.id} fileRef={draft.receipt.fileRef} />
      ) : null}
      <AppText variant="body">{t(receiptHintKey(draft, isSaved))}</AppText>
      {isSaved ? null : (
        <Button
          icon={Camera}
          label={t(draft.receipt ? "mobile.fuel.retake" : "mobile.fuel.takePhoto")}
          disabled={isDisabled}
          onPress={takePhoto}
        />
      )}
    </>
  );
}
