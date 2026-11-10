import { useEffect } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { CaptureDone } from "./CaptureDone.tsx";
import { CaptureStart } from "./CaptureStart.tsx";
import { CaptureWizard } from "./CaptureWizard.tsx";
import { NeedShift } from "./NeedShift.tsx";
import { useM08 } from "./use-m-08.ts";

/** Ovitrap capture: start, then one page per question, then "Guardado". */
export function OvitrapScreen() {
  const model = useM08();
  const t = useT();
  const { service, refresh } = model;
  useEffect(() => {
    // Lists and rules download by themselves; offline, the copy on the phone is used.
    void service
      .refresh(null)
      .catch(() => undefined)
      .then(() => refresh().catch(() => undefined));
    // Once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const state = model.state;
  if (state === null)
    return (
      <ScreenScaffold header={<AppHeader title={t("field.capture.title")} />}>
        <Skeleton />
      </ScreenScaffold>
    );
  if (state.event) return <CaptureDone model={model} event={state.event} />;
  if (state.isShiftBlocked && state.draft === null) return <NeedShift />;
  if (state.draft && !state.isShiftBlocked)
    return <CaptureWizard key={state.draft.eventId} model={model} draft={state.draft} />;
  if (state.draft) return <NeedShift />;
  return <CaptureStart model={model} />;
}
