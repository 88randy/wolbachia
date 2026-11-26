import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { IncidentCapture } from "./IncidentCapture.tsx";
import { IncidentDrafts } from "./IncidentDrafts.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentBody({ model, kind }: Props) {
  const t = useT();
  return (
    <>
      {model.state && !model.state.ready ? (
        <InfoNotice tone="warning" message={t("mobile.incidents.unavailable")} />
      ) : null}
      <IncidentCapture model={model} kind={kind} />
      <IncidentDrafts model={model} kind={kind} />
    </>
  );
}
