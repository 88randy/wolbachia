import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { IncidentBody } from "./IncidentBody.tsx";
import { IncidentFeedback } from "./IncidentFeedback.tsx";
import { IncidentFooter } from "./IncidentFooter.tsx";
import { IncidentHistory } from "./IncidentHistory.tsx";
import { IncidentRefresh } from "./IncidentRefresh.tsx";
import { useM12 } from "./use-m-12.ts";

/** P23: what happened? Big category tiles, a photo, one button. */
export function P23Screen() {
  const model = useM12();
  const t = useT();
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("mobile.incidents.title")}
          subtitle={t("courier.flow.incident.subtitle")}
        />
      }
      footer={<IncidentFooter model={model} kind="report" />}
    >
      <IncidentFeedback model={model} />
      <IncidentBody model={model} kind="report" />
      <IncidentRefresh model={model} />
      <IncidentHistory model={model} />
    </ScreenScaffold>
  );
}
