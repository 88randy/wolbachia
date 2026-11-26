import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InventoryCreateGate } from "../InventoryCreateGate";

/** Receive supplies: the arrival of one lot. */
export function LotCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t("inventory.page.newLot"));
  return (
    <PageFrame>
      <PageHeader title={t("inventory.page.newLot")} description={t("inventory.state.draft")} />
      <div className="min-w-0 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <InventoryCreateGate
          kind="lots"
          onSaved={(record) => {
            void navigate({ to: "/inventory/lots/$code", params: { code: record.code } });
          }}
        />
      </div>
    </PageFrame>
  );
}
