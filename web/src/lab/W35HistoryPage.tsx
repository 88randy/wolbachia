import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { useCan } from "../session/use-can";
import { useLabScope } from "./use-lab-scope";
import { CountHistory } from "./CountHistory";
import page from "../styles/page.module.css";
export function W35HistoryPage() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const canCreate = useCan()("egg_count.create");
  useDocumentTitle(t("lab.history.title"));
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("lab.history.title")}</h1>
      {canCreate && <Link to="/lab/egg-counts">{t("lab.count.title")}</Link>}
      <CountHistory key={scope.key} scope={scope} draftKey={"wolbachia:lab:" + scope.draftKey} />
    </section>
  );
}
