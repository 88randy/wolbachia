import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { RolesTable } from "./RolesTable";
import { MembershipsTable } from "./MembershipsTable";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
export function RolesScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t("orgAdmin.roles.title"));
  const view = useSearch({ strict: false })["view"];
  return (
    <PageFrame>
      <PageHeader title={t("orgAdmin.roles.title")} description={t("orgAdmin.roles.hint")} />
      {view === "memberships" ? <MembershipsTable /> : <RolesTable />}
    </PageFrame>
  );
}
