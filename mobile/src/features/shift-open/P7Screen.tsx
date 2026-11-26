import { Play, RotateCw, ShieldAlert } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { DepartureSummary } from "./DepartureSummary.tsx";
import { OpenFrame } from "./OpenFrame.tsx";
import { OpenedShift } from "./OpenedShift.tsx";
import { isMapReady } from "./domain.ts";
import type { M04Model } from "./use-m-04.ts";
import { useMapReady } from "./use-map-ready.ts";

/** Step 4 of 4: summary and "Salir". The offline map gets ready by itself; a severe fault blocks. */
export function P7Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  useMapReady(model);
  const state = model.state;
  if (!state) return null;
  if (state.opening) return <OpenedShift model={model} state={state} />;
  const gate = state.gate;
  const isSevere = gate === "severe";
  const isBlocked = gate !== null && !isSevere;
  const isMapFailed = state.map?.status === "failed" && !isMapReady(state.map);
  return (
    <OpenFrame
      model={model}
      step="maps"
      footer={
        <PrimaryButton
          tone={isSevere ? "danger" : "default"}
          icon={isSevere ? ShieldAlert : Play}
          label={t(isSevere ? "field.open.recordSevere" : "field.open.go")}
          disabled={model.isBusy || isBlocked}
          isLoading={model.isBusy}
          onPress={() => {
            void model.run(() => model.service.open());
          }}
        />
      }
    >
      <StepQuestion title={t("field.open.readyQuestion")} hint={t("field.open.readyHint")} />
      <DepartureSummary state={state} />
      {isSevere ? <InfoNotice tone="danger" message={t("field.open.severeNotice")} /> : null}
      {isBlocked ? <InfoNotice tone="warning" message={t(`field.open.gate.${gate}`)} /> : null}
      {isMapFailed ? (
        <SecondaryButton
          icon={RotateCw}
          label={t("field.action.retry")}
          disabled={model.isBusy}
          onPress={() => {
            void model.run(() => model.service.prepareMap());
          }}
        />
      ) : null}
    </OpenFrame>
  );
}
