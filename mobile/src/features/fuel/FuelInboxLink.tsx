import { Inbox } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelInboxLink({ model }: { readonly model: M11Model }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <SecondaryButton
      icon={Inbox}
      label={t("mobile.fuel.inbox")}
      disabled={model.isBusy}
      onPress={() => {
        void model.run(() => {
          push({ name: "inbox" });
          return Promise.resolve();
        });
      }}
    />
  );
}
