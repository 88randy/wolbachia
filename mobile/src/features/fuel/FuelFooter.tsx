import { Check, Plus } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelFooter({ model }: { readonly model: M11Model }) {
  const t = useT();
  const state = model.state;
  if (state?.draft == null) return null;
  const { event, ready, canBegin } = state;
  if (event || (!ready && canBegin)) {
    return (
      <PrimaryButton
        icon={Plus}
        label={t("mobile.fuel.beginAnother")}
        disabled={model.isBusy || !canBegin}
        onPress={() => {
          void model.recover(() => model.service.begin());
        }}
      />
    );
  }
  return (
    <>
      <PrimaryButton
        icon={Check}
        label={t("courier.flow.fuel.done")}
        isLoading={model.isBusy}
        disabled={!ready}
        onPress={model.save}
      />
    </>
  );
}
