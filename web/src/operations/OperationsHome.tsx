import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { Card } from "../ui/Card";
import page from "../styles/page.module.css";
export function OperationsHome() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <>
      <AreaPlaceholder areaId="operations" />
      {can("shift.read") && (
        <div className={page.page}>
          <Card title={t("shift.page.title")}>
            <Link to="/operations/shifts" search={{ status: "closed" }}>
              {t("shift.page.title")}
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}
