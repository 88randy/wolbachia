import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function SaveFeedback({ model }: { readonly model: M04Model }) {
  const t = useT();
  if (model.errorKey === null) return null;
  return (
    <>
      <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
      <ShiftAction
        label={t("mobile.shiftOpen.retrySave")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => Promise.resolve());
        }}
      />
    </>
  );
}
