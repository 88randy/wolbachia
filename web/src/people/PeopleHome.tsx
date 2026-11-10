import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { Card } from "../ui/Card";
export function PeopleHome() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <Card headingLevel={1} title={t("evaluations.page.people")}>
      {(can("training.read") || can("training.manage")) && (
        <p>
          <Link to="/people/trainings">{t("evaluations.page.trainings")}</Link>
        </p>
      )}
      {(can("evaluation.read") || can("evaluation.create")) && (
        <p>
          <Link to="/people/evaluations">{t("evaluations.page.title")}</Link>
        </p>
      )}
    </Card>
  );
}
