import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { Card } from "../ui/Card";
import page from "../styles/page.module.css";
export function FleetHome() {
  const { t } = useTranslation();
  return (
    <>
      <AreaPlaceholder areaId="fleet" />
      <div className={page.page}>
        <Card title={t("fleet.page.title")}>
          <Link to="/fleet/motorcycles">{t("fleet.page.title")}</Link>
        </Card>
      </div>
    </>
  );
}
