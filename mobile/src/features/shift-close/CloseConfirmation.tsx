import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { M14Model } from "./use-m-14.ts";

interface Props {
  readonly model: M14Model;
  readonly cancel: () => void;
}
export function CloseConfirmation({ model, cancel }: Props) {
  const t = useT();
  const close = () => {
    void model.run(() => model.service.close());
  };
  return (
    <Card>
      <AppText variant="button">{t("mobile.shiftClose.confirmTitle")}</AppText>
      <AppText>{t("mobile.shiftClose.confirmHint")}</AppText>
      <Button
        label={t("common.actions.cancel")}
        variant="text"
        disabled={model.isBusy}
        onPress={cancel}
      />
      <Button label={t("mobile.shiftClose.close")} disabled={model.isBusy} onPress={close} />
    </Card>
  );
}
