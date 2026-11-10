import { ArrowRight, Save } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { CaptureNotices } from "./CaptureNotices.tsx";
import { CapturePageBody } from "./CapturePageBody.tsx";
import type { CaptureProps } from "./model.ts";
import { saveGate } from "./validation.ts";
import { useCaptureFlow } from "./use-capture-flow.ts";

function isSaveBlocked(props: CaptureProps): boolean {
  const { model, draft } = props;
  if (model.state?.isScopeBlocked || model.state?.isBagReserved) return true;
  if (model.state?.repeat && !draft.replacesEventId) return true;
  return saveGate(draft, new Date()) !== null;
}

/** One capture (place or check) as pages: "Paso X de N", one question, one button at the bottom. */
export function CaptureWizard(props: CaptureProps) {
  const { model, draft } = props;
  const t = useT();
  const flow = useCaptureFlow(props);
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t(
            draft.mode === "place" ? "field.capture.titlePlace" : "field.capture.titleCheck",
          )}
          subtitle={draft.point ? t("field.day.point", { code: draft.point.code }) : undefined}
          step={{ current: flow.number, total: flow.total }}
          onBack={flow.isFirst ? undefined : flow.back}
        />
      }
      footer={
        flow.isLast ? (
          <PrimaryButton
            icon={Save}
            label={t("field.capture.save")}
            isLoading={model.isBusy}
            disabled={model.isBusy || isSaveBlocked(props)}
            onPress={() => {
              void model.run(() => model.service.save(draft.eventId), {
                eventId: draft.eventId,
              });
            }}
          />
        ) : (
          <PrimaryButton
            icon={ArrowRight}
            label={t("field.action.next")}
            disabled={model.isBusy || !flow.isDone}
            onPress={flow.next}
          />
        )
      }
    >
      {model.errorKey ? <InfoNotice tone="danger" message={t("field.capture.problem")} /> : null}
      <CaptureNotices {...props} />
      <CapturePageBody page={flow.page} {...props} />
    </ScreenScaffold>
  );
}
