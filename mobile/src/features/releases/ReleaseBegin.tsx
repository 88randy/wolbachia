import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseBegin({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  return (
    <Card>
      <AppText>{t("mobile.release.beginHint")}</AppText>
      <Button
        label={t("mobile.release.begin")}
        disabled={!model.canBegin || model.isBusy}
        onPress={model.begin}
      />
    </Card>
  );
}
