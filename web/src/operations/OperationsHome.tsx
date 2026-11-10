import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { Card } from "../ui/Card";
import { useDocumentTitle } from "../shell/use-document-title";

export function OperationsHome() {
  const { t } = useTranslation();
  const me = useMe();
  useDocumentTitle(t("reviews.workspace.operations"));
  return (
    <Card title={t("reviews.workspace.operations")} headingLevel={1}>
      {me.permissions.includes("review_item.read") && (
        <p>
          <Link to="/operations/reviews">{t("reviews.workspace.title")}</Link>
        </p>
      )}
      {me.permissions.includes("relocation.read") && (
        <p>
          <Link to="/operations/relocations">{t("relocations.workspace.title")}</Link>
        </p>
      )}
    </Card>
  );
}
