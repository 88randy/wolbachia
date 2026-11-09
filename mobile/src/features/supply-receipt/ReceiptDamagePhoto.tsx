import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptDamagePhoto({ model }: { readonly model: M05Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <View>
      {draft.discrepancy?.kind === "damaged" ? (
        <ShiftAction
          label={t("mobile.supplyReceipt.photo")}
          disabled={isReceiptReadOnly(model)}
          onPress={() => {
            void model.run(() => model.service.photo(draft.eventId));
          }}
        />
      ) : null}
      {draft.evidence.length ? <AppText>{t("mobile.supplyReceipt.photoSaved")}</AppText> : null}
    </View>
  );
}
