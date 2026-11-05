import { HomeShiftAction } from "./HomeShiftAction.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { DepartureActions } from "./DepartureActions.tsx";
import { MapStatus } from "./MapStatus.tsx";
import { ShiftStatus } from "./ShiftStatus.tsx";
import type { M04Model } from "./use-m-04.ts";
export function P7Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const state = model.state;
  if (!state) return null;
  return (
    <>
      <AppText variant="button">{t("mobile.shiftOpen.mapsTitle")}</AppText>
      <MapStatus map={state.map} />
      {state.opening ? (
        <>
          <ShiftStatus state={state} />
          <HomeShiftAction model={model} />
        </>
      ) : (
        <DepartureActions model={model} />
      )}
    </>
  );
}
