import { editConfirmation } from "./confirmation-command.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { saveGate } from "./validation.ts";
import { GATE_KEYS } from "./gate-key.ts";
import { ReviewNotice } from "./ReviewNotice.tsx";
import { CaptureSummary } from "./CaptureSummary.tsx";
import { CaptureCommand } from "./CaptureCommand.tsx";
import type { CaptureProps } from "./model.ts";
function isSaveBlocked(props: CaptureProps): boolean {
  if (props.model.state?.isScopeBlocked || props.model.state?.isBagReserved) return true;
  return Boolean(props.model.state?.repeat && !props.draft.replacesEventId);
}
export function Confirmation(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  const gate = saveGate(draft, new Date());
  const isRepeatBlocked = isSaveBlocked(props);
  return (
    <View>
      {model.state?.isBagReserved ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.newBag")} />
      ) : null}
      <CaptureSummary draft={draft} />
      <ReviewNotice {...props} />
      {gate ? <Notice tone="warning" icon="alert" message={t(GATE_KEYS[gate])} /> : null}
      <ShiftAction
        label={t("mobile.ovitrap.edit")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => editConfirmation(model.service, draft), { eventId: draft.eventId });
        }}
      />
      <CaptureCommand
        eventId={draft.eventId}
        model={model}
        command="save"
        disabled={gate !== null || isRepeatBlocked}
      />
    </View>
  );
}
