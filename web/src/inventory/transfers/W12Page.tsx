import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { hasCenterScope } from "../../centers/center-selection";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryCode, useInventoryContext } from "../use-inventory-context";
import { TransferList } from "./TransferList";
import { W13Page } from "./W13Page";
import page from "../../styles/page.module.css";
export function W12Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const code = useInventoryCode();
  const me = useMe();
  useDocumentTitle(t("transfers.page.title"));
  const hasScope = hasCenterScope(me.scope);
  if (!hasScope) return <InlineNotice tone="warning">{t("transfers.page.denied")}</InlineNotice>;
  const owner = JSON.stringify([scope.base, code]);
  return (
    <section className={page.page}>
      {code ? (
        <W13Page key={owner} code={code} scope={scope} />
      ) : (
        <TransferList key={scope.context} scope={scope} />
      )}
    </section>
  );
}
