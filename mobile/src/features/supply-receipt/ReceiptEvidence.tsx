import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { SignaturePad } from "./SignaturePad.tsx";
import { ReceiptDamagePhoto } from "./ReceiptDamagePhoto.tsx";
import type { M05Model } from "./use-m-05.ts";
function signatureProps(model: M05Model) {
  const draft = model.state?.draft;
  return {
    strokes: draft?.strokes ?? [],
    disabled: isReceiptReadOnly(model),
    onChange: (strokes: readonly string[]) => {
      model.edit(
        "strokes",
        (eventId) => model.service.strokes(strokes, eventId),
        (current) => ({ ...current, strokes, signature: null }),
      );
    },
    onSign: (port: import("../ovitrap-check/types.ts").EvidencePort) => {
      void model.run(() => model.service.signature(port, draft?.eventId));
    },
  };
}

export function ReceiptEvidence({ model }: { readonly model: M05Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <View>
      <ReceiptDamagePhoto model={model} />
      <SignaturePad key={draft.eventId} {...signatureProps(model)} />
      <ShiftAction
        label={t("mobile.supplyReceipt.signaturePhoto")}
        disabled={isReceiptReadOnly(model)}
        onPress={() => {
          void model.run(() => model.service.signaturePhoto(draft.eventId));
        }}
      />
      {draft.signature ? <AppText>{t("mobile.supplyReceipt.signatureSaved")}</AppText> : null}
    </View>
  );
}
