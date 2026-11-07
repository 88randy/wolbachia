import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M09Model } from "./use-m-09.ts";
import type { MessageKey } from "@wolbachia/i18n";
const LABELS = {
  refreshGps: "mobile.lifecycle.captureGps",
  captureEvidence: "mobile.lifecycle.capturePhoto",
  undoEvidence: "mobile.lifecycle.undo",
  refresh: "mobile.lifecycle.download",
  refreshAdvisory: "common.actions.retry",
  adoptSnapshots: "mobile.lifecycle.adopt",
} as const satisfies Record<string, MessageKey>;
interface Props {
  readonly model: M09Model;
  readonly eventId: string | null;
  readonly command: keyof typeof LABELS;
}
export function LifecycleCommand({ model, eventId, command }: Props) {
  const t = useT();
  return (
    <ShiftAction
      label={t(LABELS[command])}
      disabled={model.isBusy || !model.state}
      onPress={() => {
        void model.run(() => model.service[command](eventId), eventId);
      }}
    />
  );
}
