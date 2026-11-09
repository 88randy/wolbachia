import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InventoryCreateGate } from "../InventoryCreateGate";
import page from "../../styles/page.module.css";
export function LotCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("inventory.page.newLot"));
  return (
    <section className={page.page}>
      <Card title={t("inventory.page.newLot")} headingLevel={1}>
        <p>{t("inventory.state.draft")}</p>
        <InventoryCreateGate
          kind="lots"
          onSaved={(record) => {
            void navigate({ to: "/inventory/lots/$code", params: { code: record.code } });
          }}
        />
      </Card>
    </section>
  );
}
