import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { BottomActions } from "../../ui/BottomActions.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelFooter({ model }: { readonly model: M11Model }) {
  const t = useT();
  const state = model.state;
  if (state?.draft == null) return null;
  const { event, ready, canBegin } = state;
  return (
    <BottomActions>
      {event || (!ready && canBegin) ? (
        <Button
          label={t("mobile.fuel.beginAnother")}
          disabled={model.isBusy || !canBegin}
          onPress={() => {
            void model.recover(() => model.service.begin());
          }}
        />
      ) : (
        <>
          <AppText variant="caption">{t("mobile.fuel.saveHint")}</AppText>
          <Button
            label={t(model.isBusy ? "mobile.fuel.working" : "mobile.fuel.save")}
            disabled={model.isBusy || !ready}
            onPress={model.save}
          />
        </>
      )}
    </BottomActions>
  );
}
