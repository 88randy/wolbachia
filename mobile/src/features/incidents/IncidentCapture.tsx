import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { IncidentForm } from "./IncidentForm.tsx";
import { IncidentStatus } from "./IncidentStatus.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentCapture({ model, kind }: Props) {
  const t = useT();
  const state = model.state;
  if (!state)
    return (
      <>
        <Skeleton />
        <Skeleton isShort />
        <Skeleton />
      </>
    );
  if (state.draft?.kind !== kind)
    return (
      <AppText variant="body" tone="secondary">
        {t(kind === "report" ? "mobile.incidents.empty" : "mobile.incidents.accidentHint")}
      </AppText>
    );
  const draftKey = model.hasPending
    ? "mobile.incidents.draftPending"
    : "mobile.incidents.draftSaved";
  return (
    <>
      <IncidentStatus state={state} />
      {state.event ? null : (
        <AppText variant="caption" tone="secondary">
          {t(draftKey)}
        </AppText>
      )}
      <IncidentForm model={model} />
    </>
  );
}
