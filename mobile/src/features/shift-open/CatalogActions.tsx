import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function CatalogActions({ model }: { readonly model: M04Model }) {
  const t = useT();
  const refresh = () => {
    void model
      .run(() => model.service.refreshCatalog())
      .then((ok) => {
        if (!ok) model.setError("mobile.shiftOpen.catalogUnavailable");
      });
  };
  return (
    <>
      <ShiftAction
        label={t("mobile.shiftOpen.refreshCatalog")}
        disabled={model.isBusy}
        onPress={refresh}
      />
      {model.state?.gate !== "catalogChanged" ? null : (
        <ShiftAction
          label={t("mobile.shiftOpen.confirmCatalog")}
          disabled={model.isBusy}
          onPress={() => {
            void model.run(() => model.service.confirmCatalog());
          }}
        />
      )}
    </>
  );
}
