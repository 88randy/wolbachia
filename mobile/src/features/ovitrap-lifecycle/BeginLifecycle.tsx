import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M09Model } from "./use-m-09.ts";
import type { StartInput } from "./new-draft.ts";
export function BeginLifecycle({
  model,
  input,
}: {
  readonly model: M09Model;
  readonly input: StartInput;
}) {
  const t = useT();
  const state = model.state;
  if (!state || (state.draft && !state.event && !state.isShiftBlocked)) return null;
  const eventId = state.draft?.eventId ?? null;
  const begin = () => {
    void model.run(() => model.service.start(input, eventId), eventId, true);
  };
  return (
    <ShiftAction label={t("mobile.lifecycle.begin")} disabled={model.isBusy} onPress={begin} />
  );
}
