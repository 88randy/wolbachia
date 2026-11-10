import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelInboxLink({ model }: { readonly model: M11Model }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <Button
      variant="text"
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
