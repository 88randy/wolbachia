import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseFeedback({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (!model.errorKey) return null;
  return (
    <>
      <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
      <Button
        variant="outline"
        disabled={model.isBusy}
        label={t("common.actions.retry")}
        onPress={model.retry}
      />
    </>
  );
}
