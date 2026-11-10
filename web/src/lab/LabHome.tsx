import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
export function LabHome() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("shell.nav.lab"));
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("shell.nav.lab")}</h1>
      {can("bag.receive") && <Link to="/lab/bags">{t("labReception.page.title")}</Link>}
      {can("egg_count.create") && <Link to="/lab/egg-counts">{t("lab.count.title")}</Link>}
      {can("bag.dispose") && <Link to="/lab/write-offs">{t("allocation.lab.title")}</Link>}
      {can("egg_count.read") && <Link to="/lab/count-history">{t("lab.history.title")}</Link>}
    </section>
  );
}
