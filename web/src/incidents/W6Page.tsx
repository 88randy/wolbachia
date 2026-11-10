import { useSearch } from "@tanstack/react-router";
import { centerIdentity } from "../centers/center-filter";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { IncidentCounts } from "./IncidentCounts";
import { IncidentTray } from "./IncidentTray";
import { useIncidentScope, incidentScopeKey } from "./use-incident-scope";
import styles from "./incidents.module.css";
export function W6Page() {
  const { t } = useTranslation();
  const sessionScope = useIncidentScope();
  const search = useSearch({ strict: false });
  const center =
    "center" in search && typeof search.center === "string" ? search.center : undefined;
  const scope = { ...sessionScope, identity: centerIdentity(sessionScope.identity, center) };
  useDocumentTitle(t("incidents.workspace.title"));
  return (
    <section className={styles.page} key={incidentScopeKey(scope.identity)}>
      <h1>{t("incidents.workspace.title")}</h1>
      <IncidentCounts scope={scope} />
      <IncidentTray />
    </section>
  );
}
