import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptHistory({ model }: { readonly model: M05Model }) {
  const t = useT();
  return (
    <View>
      {model.state?.drafts.map((draft) => (
        <ShiftAction
          key={draft.eventId}
          label={[t("mobile.supplyReceipt.resume"), draft.assignmentId].join("\n")}
          disabled={model.isBusy}
          onPress={() => {
            void model.run(() => model.service.select(draft.eventId));
          }}
        />
      ))}
    </View>
  );
}
