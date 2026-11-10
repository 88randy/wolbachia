import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { EmergencyAction } from "./EmergencyAction.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";
interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentBeginAction({ model, kind }: Props) {
  const t = useT();
  const disabled = model.isBusy || !model.state?.canBegin;
  const onPress = () => {
    void model.recover(() => model.service.begin(kind));
  };
  return kind === "accident" ? (
    <EmergencyAction
      label={t("mobile.incidents.beginAccident")}
      icon="alert"
      disabled={disabled}
      onPress={onPress}
    />
  ) : (
    <Button label={t("mobile.incidents.begin")} disabled={disabled} onPress={onPress} />
  );
}
