import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
export function LabHome() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("shell.area.lab"));
  return <section className={page.page}><h1 className={page.title}>{t("shell.area.lab")}</h1>
    {can("egg_count.create") && <Link to="/lab/egg-counts">{t("lab.count.title")}</Link>}
    {can("egg_count.read") && <Link to="/lab/count-history">{t("lab.history.title")}</Link>}
  </section>;
}
