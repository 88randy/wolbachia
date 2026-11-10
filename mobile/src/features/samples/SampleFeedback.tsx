import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleFeedback({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  return (
    <>
      {model.errorKey ? <Notice tone="critical" icon="alert" message={t(model.errorKey)} /> : null}
      <Button
        variant="outline"
        disabled={model.isBusy}
        label={t(model.errorKey ? "common.actions.retry" : "mobile.sample.refresh")}
        onPress={model.retry}
      />
    </>
  );
}
