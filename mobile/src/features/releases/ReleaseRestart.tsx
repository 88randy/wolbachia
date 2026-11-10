import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

/** A fresh origin never changes or approves the retained original draft or its evidence. */
export function ReleaseRestart({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (!model.hasDraft || !model.canRestart || model.status !== "draft") return null;
  return (
    <Card>
      <AppText>{t("mobile.release.restartHint")}</AppText>
      <Button
        variant="outline"
        label={t("mobile.release.restart")}
        disabled={model.isBusy}
        onPress={model.restart}
      />
    </Card>
  );
}
