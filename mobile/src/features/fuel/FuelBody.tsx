import { useEffect, useRef } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { FuelAdvisory } from "./FuelAdvisory.tsx";
import { FuelEmpty } from "./FuelEmpty.tsx";
import { FuelForm } from "./FuelForm.tsx";
import { FuelLoading } from "./FuelLoading.tsx";
import { FuelReceipt } from "./FuelReceipt.tsx";
import { FuelStatus } from "./FuelStatus.tsx";
import type { M11Model } from "./use-m-11.ts";

/** No draft yet: go straight to the form instead of an empty screen with one button. */
function useAutoBegin(model: M11Model): void {
  const started = useRef(false);
  const state = model.state;
  const shouldBegin = state !== null && state.ready && !state.draft && !state.event;
  useEffect(() => {
    if (!shouldBegin || started.current || model.isBusy) return;
    started.current = true;
    void model.run(() => model.service.begin());
    // Once per visit; the model object changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBegin]);
}

/** The ticket photo comes first (the courier is at the pump), then the numbers. */
export function FuelBody({ model }: { readonly model: M11Model }) {
  const t = useT();
  useAutoBegin(model);
  if (!model.state) return <FuelLoading />;
  const { ready, draft, event, advisory } = model.state;
  return (
    <>
      {!ready ? <InfoNotice tone="warning" message={t("mobile.fuel.unavailable")} /> : null}
      {draft ? (
        <>
          <FuelStatus state={model.state} />
          {event || !model.hasPending ? null : (
            <AppText variant="caption" tone="secondary">
              {t("mobile.fuel.draftPending")}
            </AppText>
          )}
          <FuelReceipt model={model} />
          <FuelForm model={model} />
          <FuelAdvisory advisory={advisory} />
        </>
      ) : (
        <FuelEmpty model={model} />
      )}
    </>
  );
}
