import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import type { M14Model } from "./use-m-14.ts";

function closeFieldActions(model: M14Model) {
  return {
    changeOdometer: (odometer: string) => {
      model.edit({ odometer });
    },
    changeNote: (note: string) => {
      model.edit({ note });
    },
  };
}
export function CloseOdometerForm({ model }: { readonly model: M14Model }) {
  const t = useT();
  const actions = closeFieldActions(model);
  const draft = model.state?.draft;
  if (!draft) return null;
  const opening = model.state?.opening?.envelope.payload as { odometer_km?: number } | undefined;
  const isLow = Number(draft.odometer) < (opening?.odometer_km ?? 0);
  return (
    <Card>
      <ShiftField
        label={t("mobile.shiftClose.odometer")}
        value={draft.odometer}
        numeric
        disabled={model.isBusy}
        onChange={actions.changeOdometer}
      />
      {isLow ? (
        <Notice tone="warning" icon="alert" message={t("mobile.shiftClose.lowOdometer")} />
      ) : null}
      <ShiftField
        label={t("mobile.shiftClose.note")}
        value={draft.note}
        disabled={model.isBusy}
        onChange={actions.changeNote}
      />
    </Card>
  );
}
