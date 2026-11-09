import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelEmpty({ model }: { readonly model: M11Model }) {
  const t = useT();
  return (
    <Card>
      <AppText>{t("mobile.fuel.empty")}</AppText>
      <Button
        label={t("mobile.fuel.begin")}
        disabled={model.isBusy || !model.state?.ready}
        onPress={() => {
          void model.run(() => model.service.begin());
        }}
      />
    </Card>
  );
}
