import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { RolesTable } from "./RolesTable";
import { MembershipsTable } from "./MembershipsTable";
import styles from "./organization.module.css";
export function RolesScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t("orgAdmin.roles.title"));
  const view = useSearch({ strict: false })["view"];
  return (
    <section className={styles.page}>
      <h1>{t("orgAdmin.roles.title")}</h1>
      {view === "memberships" ? <MembershipsTable /> : <RolesTable />}
    </section>
  );
}
