import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryCode, useInventoryContext } from "../use-inventory-context";
import { DiscrepancyList } from "./DiscrepancyList";
import { DiscrepancyRecord } from "./DiscrepancyRecord";

export function W14Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const code = useInventoryCode();
  useDocumentTitle(t("discrepancies.page.title"));
  const key = JSON.stringify([scope.base, code]);
  if (!scope.identity.permissions?.includes("discrepancy.read") || !scope.identity.hasScope)
    return <InlineNotice tone="warning">{t("discrepancies.page.denied")}</InlineNotice>;
  return code ? <DiscrepancyRecord key={key} code={code} /> : <DiscrepancyList key={key} />;
}
