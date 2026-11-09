import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M14Model } from "./use-m-14.ts";

export function CloseError({ model }: { readonly model: M14Model }) {
  const t = useT();
  const retry = () => {
    void model.run(() => model.service.start());
  };
  if (!model.hasError) return null;
  return (
    <>
      <Notice tone="critical" icon="alert" message={t("mobile.shiftClose.saveFailed")} />
      <Button label={t("common.actions.retry")} onPress={retry} />
    </>
  );
}
