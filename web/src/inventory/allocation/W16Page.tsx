import { useTranslation } from "react-i18next";
import { hasCenterScope } from "../../centers/center-selection";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryContext } from "../use-inventory-context";
import { ReconciliationList } from "./ReconciliationList";
import page from "../../styles/page.module.css";

/** W16 daily reconciliation. A scope or session change remounts the list and drops old results. */
export function W16Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const me = useMe();
  useDocumentTitle(t("allocation.reconciliation.title"));
  if (!hasCenterScope(me.scope))
    return <InlineNotice tone="warning">{t("allocation.page.denied")}</InlineNotice>;
  return (
    <section className={page.page}>
      <ReconciliationList key={scope.context} scope={scope} />
    </section>
  );
}
