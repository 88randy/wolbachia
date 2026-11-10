import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptInboxLink({ model }: { readonly model: M05Model }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <ShiftAction
      label={t("mobile.supplyReceipt.inbox")}
      onPress={() => {
        void model.recover(() => {
          push({ name: "inbox" });
          return Promise.resolve();
        });
      }}
    />
  );
}
