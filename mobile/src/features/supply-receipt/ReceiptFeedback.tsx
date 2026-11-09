import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptFeedback({ model }: { readonly model: M05Model }) {
  const t = useT();
  const feedback = model.state?.feedback;
  return (
    <View>
      {model.errorKey ? <Notice tone="critical" icon="alert" message={t(model.errorKey)} /> : null}
      {feedback ? (
        <Notice
          tone={feedback === "invalid" ? "warning" : "info"}
          icon={feedback === "invalid" ? "ban" : "check"}
          message={t(`mobile.supplyReceipt.${feedback}`)}
        />
      ) : null}
      <ShiftAction
        label={t("mobile.supplyReceipt.refresh")}
        disabled={model.isBusy}
        onPress={() => {
          void model.recover(() => model.service.refresh());
        }}
      />
    </View>
  );
}
