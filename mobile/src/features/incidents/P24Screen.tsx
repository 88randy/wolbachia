import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { EmergencyContact } from "./EmergencyContact.tsx";
import { IncidentBody } from "./IncidentBody.tsx";
import { IncidentFeedback } from "./IncidentFeedback.tsx";
import { IncidentFooter } from "./IncidentFooter.tsx";
import { IncidentRefresh } from "./IncidentRefresh.tsx";
import { useM12 } from "./use-m-12.ts";

/** P24: the call comes first; the accident report is a short second step. */
export function P24Screen() {
  const model = useM12();
  const t = useT();
  const { push } = useNavigation();
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("mobile.incidents.emergency")}
          subtitle={t("mobile.incidents.emergencyHint")}
        />
      }
      footer={
        <IncidentFooter
          model={model}
          kind="accident"
          closeShift={() => {
            push({ name: "closeShift" });
          }}
        />
      }
    >
      <EmergencyContact model={model} />
      <IncidentFeedback model={model} />
      <IncidentBody model={model} kind="accident" />
      <IncidentRefresh model={model} />
    </ScreenScaffold>
  );
}
