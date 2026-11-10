import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { AllocationLinks } from "./allocation/AllocationLinks";
import page from "../styles/page.module.css";
export function InventoryHome() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("inventory.page.home"));
  return (
    <section className={page.page}>
      <Card title={t("inventory.page.home")} headingLevel={1}>
        <nav aria-label={t("inventory.page.home")} className={page.actions}>
          {can("transfer.read") && (
            <Link to="/inventory/transfers">{t("transfers.page.title")}</Link>
          )}
          {can("discrepancy.read") && (
            <Link to="/inventory/discrepancies">{t("discrepancies.page.title")}</Link>
          )}
          <AllocationLinks />
          {can("supply_type.read") && (
            <Link to="/inventory/supplies">{t("inventory.page.supplies")}</Link>
          )}
          {can("lot.read") && <Link to="/inventory/lots">{t("inventory.page.lots")}</Link>}
          {can("location.read") && (
            <Link to="/inventory/locations">{t("inventory.page.locations")}</Link>
          )}
        </nav>
      </Card>
    </section>
  );
}
