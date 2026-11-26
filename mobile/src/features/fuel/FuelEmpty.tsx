import { Fuel } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelEmpty({ model }: { readonly model: M11Model }) {
  const t = useT();
  return (
    <EmptyState
      icon={Fuel}
      title={t("mobile.fuel.title")}
      message={t("mobile.fuel.empty")}
      actionLabel={t("courier.flow.fuel.begin")}
      actionIcon={Fuel}
      onAction={() => {
        if (model.isBusy || !model.state?.ready) return;
        void model.run(() => model.service.begin());
      }}
    />
  );
}
