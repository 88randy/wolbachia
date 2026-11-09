import { useTranslation } from "react-i18next";
import { Link, useSearch } from "@tanstack/react-router";
import { useDocumentTitle } from "../shell/use-document-title";
import { useCan } from "../session/use-can";
import { useLabScope } from "./use-lab-scope";
import { CountWorkspace } from "./CountWorkspace";
import page from "../styles/page.module.css";
/** W35: identity-scoped, server-confirmed egg counting. */
export function W35Page() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const search = useSearch({ strict: false });
  const canRead = useCan()("egg_count.read");
  useDocumentTitle(t("lab.count.title"));
  return <section className={page.page}><h1 className={page.title}>{t("lab.count.title")}</h1>
    {canRead && <Link to="/lab/count-history">{t("lab.history.title")}</Link>}
    <CountWorkspace key={scope.key + JSON.stringify(search)} scope={scope} draftKey={"wolbachia:lab:" + scope.draftKey} />
  </section>;
}
