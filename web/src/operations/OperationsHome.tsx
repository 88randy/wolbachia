import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { Card } from "../ui/Card";
import { useDocumentTitle } from "../shell/use-document-title";

export function OperationsHome() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("reviews.workspace.operations"));
  return (
    <Card title={t("reviews.workspace.operations")} headingLevel={1}>
      {can("review_item.read") && (
        <p>
          <Link to="/operations/reviews">{t("reviews.workspace.title")}</Link>
        </p>
      )}
      {can("relocation.read") && (
        <p>
          <Link to="/operations/relocations">{t("relocations.workspace.title")}</Link>
        </p>
      )}
      {can("shift.read") && (
        <p>
          <Link to="/operations/shifts" search={{ status: "closed" }}>
            {t("shift.page.title")}
          </Link>
        </p>
      )}
    </Card>
  );
}
