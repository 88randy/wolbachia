import { useEffect, useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { CaptureDone } from "./CaptureDone.tsx";
import { CaptureStart } from "./CaptureStart.tsx";
import { CaptureWizard } from "./CaptureWizard.tsx";
import { NeedShift } from "./NeedShift.tsx";
import { StaleDraftChoice } from "./StaleDraftChoice.tsx";
import { useAutoPlace } from "./use-auto-place.ts";
import { useM08 } from "./use-m-08.ts";

/** Ovitrap capture: start, then one page per question, then "Guardado". */
export function OvitrapScreen({ pointId }: { readonly pointId?: string }) {
  const model = useM08();
  const [isReady, setReady] = useState(false);
  useAutoPlace(model, pointId, isReady);
  const t = useT();
  const { service, refresh } = model;
  useEffect(() => {
    // Lists and rules download by themselves; offline, the copy on the phone is used.
    void service
      .syncAssignment()
      .then(() => service.refresh(null))
      .catch(() => undefined)
      .then(() => refresh().catch(() => undefined))
      .then(() => {
        setReady(true);
      });
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
  if (state.staleDraft && state.draft)
    return (
      <StaleDraftChoice model={model} eventId={state.draft.eventId} stale={state.staleDraft} />
    );
  if (state.isShiftBlocked && state.draft === null) return <NeedShift />;
  if (state.draft && !state.isShiftBlocked)
    return <CaptureWizard key={state.draft.eventId} model={model} draft={state.draft} />;
  if (state.draft) return <NeedShift />;
  return <CaptureStart model={model} />;
}
