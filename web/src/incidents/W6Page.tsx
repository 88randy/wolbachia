import { useSearch } from "@tanstack/react-router";
import { centerIdentity } from "../centers/center-filter";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { IncidentCounts } from "./IncidentCounts";
import { IncidentTray } from "./IncidentTray";
import { useIncidentScope, incidentScopeKey } from "./use-incident-scope";
export function W6Page() {
  const { t } = useTranslation();
  const sessionScope = useIncidentScope();
  const search = useSearch({ strict: false });
  const center =
    "center" in search && typeof search.center === "string" ? search.center : undefined;
  const scope = { ...sessionScope, identity: centerIdentity(sessionScope.identity, center) };
  return (
    <ListPage
      key={incidentScopeKey(scope.identity)}
      title={t("incidents.workspace.title")}
      description={t("incidents.workspace.purpose")}
    >
      <IncidentCounts scope={scope} />
      <IncidentTray />
    </ListPage>
  );
}
