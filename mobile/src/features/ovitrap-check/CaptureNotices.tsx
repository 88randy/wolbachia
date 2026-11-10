import { RefreshCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { CaptureProps } from "./model.ts";

/** Things that changed under the courier: new lists downloaded, or a point that is not theirs. */
export function CaptureNotices({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <>
      {model.state?.isScopeBlocked ? (
        <InfoNotice tone="warning" message={t("field.capture.notYours")} />
      ) : null}
      {model.state?.catalogChanged ? (
        <>
          <InfoNotice tone="warning" message={t("field.capture.listChanged")} />
          <SecondaryButton
            icon={RefreshCw}
            label={t("field.capture.listChangedAction")}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.adoptSnapshots(draft.eventId), {
                eventId: draft.eventId,
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}
