import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M08Model } from "./use-m-08.ts";
const LABELS = {
  startPlace: "mobile.ovitrap.place",
  refresh: "mobile.ovitrap.refresh",
  adoptSnapshots: "mobile.ovitrap.adopt",
  captureEvidence: "mobile.ovitrap.photo",
  refreshGps: "mobile.ovitrap.retryGps",
  save: "mobile.ovitrap.save",
  correct: "mobile.ovitrap.correct",
} as const;
interface Props {
  readonly model: M08Model;
  readonly command: keyof typeof LABELS;
  readonly disabled?: boolean;
}
export function CaptureCommand({ model, command, disabled = false }: Props) {
  const t = useT();
  return (
    <ShiftAction
      label={t(LABELS[command])}
      disabled={model.isBusy || disabled}
      onPress={() => {
        void model.run(async () => {
          const result = await model.service[command]();
          if (command === "captureEvidence" && result === false)
            model.setError("mobile.ovitrap.photoUnavailable");
        });
      }}
    />
  );
}
