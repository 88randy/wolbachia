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

/** The ticket photo comes first (the courier is at the pump), then the numbers. */
export function FuelBody({ model }: { readonly model: M11Model }) {
  const t = useT();
  if (!model.state) return <FuelLoading />;
  const { ready, draft, event, advisory } = model.state;
  return (
    <>
      {!ready ? <InfoNotice tone="warning" message={t("mobile.fuel.unavailable")} /> : null}
      {draft ? (
        <>
          <FuelStatus state={model.state} />
          {event ? null : (
            <AppText variant="caption" tone="secondary">
              {t(model.hasPending ? "mobile.fuel.draftPending" : "mobile.fuel.draftSaved")}
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
