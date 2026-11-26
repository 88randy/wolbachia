import { Camera } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { isReceiptReadOnly } from "./editing.ts";
import type { ReceiptDraft } from "./receipt-types.ts";
import type { M05Model } from "./use-m-05.ts";

/** Photo of the damaged supplies, kept on the phone with the receipt. */
export function ReceiptDamagePhoto({
  model,
  draft,
}: {
  readonly model: M05Model;
  readonly draft: ReceiptDraft;
}) {
  const t = useT();
  return (
    <>
      <SecondaryButton
        icon={Camera}
        label={t(draft.evidence.length ? "field.open.photoAgain" : "field.open.photoTake")}
        disabled={isReceiptReadOnly(model)}
        onPress={() => {
          void model.run(() => model.service.photo(draft.eventId));
        }}
      />
      {draft.evidence.length ? (
        <InfoNotice tone="success" message={t("field.open.photoSaved")} />
      ) : null}
    </>
  );
}
