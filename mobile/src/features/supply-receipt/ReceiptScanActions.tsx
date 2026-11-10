import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptScanActions({
  model,
  value,
}: {
  readonly model: M05Model;
  readonly value: string;
}) {
  const t = useT();
  const eventId = model.state?.draft?.eventId;
  const disabled = isReceiptReadOnly(model) || !value.trim();
  return (
    <View>
      <ShiftAction
        label={t("mobile.supplyReceipt.scan")}
        disabled={disabled}
        onPress={() => {
          void model.run(() => model.service.scan(value, eventId));
        }}
      />
      <ShiftAction
        label={t("mobile.supplyReceipt.manual")}
        disabled={disabled}
        onPress={() => {
          void model.run(() => model.service.manual(value, eventId));
        }}
      />
    </View>
  );
}
