import { Plus, Siren } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentBeginAction({ model, kind }: Props) {
  const t = useT();
  const disabled = !model.state?.canBegin;
  const onPress = () => {
    void model.recover(() => model.service.begin(kind));
  };
  return kind === "accident" ? (
    <PrimaryButton
      tone="danger"
      icon={Siren}
      label={t("mobile.incidents.beginAccident")}
      isLoading={model.isBusy}
      disabled={disabled}
      onPress={onPress}
    />
  ) : (
    <PrimaryButton
      icon={Plus}
      label={t("mobile.incidents.begin")}
      isLoading={model.isBusy}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
