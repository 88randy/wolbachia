import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import page from "../styles/page.module.css";
export function FleetHome() {
  const { t } = useTranslation();
  return (
    <>
      <AreaPlaceholder areaId="fleet" />
      <div className={page.page}>
        <Link to="/fleet/motorcycles">{t("fleet.page.title")}</Link>
      </div>
    </>
  );
}
