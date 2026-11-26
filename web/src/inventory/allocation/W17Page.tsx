import { useTranslation } from "react-i18next";
import { hasCenterScope } from "../../centers/center-selection";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryContext } from "../use-inventory-context";
import { WRITE_OFFS_ROUTE } from "./allocation-query";
import { WriteOffWorkspace } from "./WriteOffWorkspace";

/** W17 shrinkage and write-offs of the warehouse. */
export function W17Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const me = useMe();
  useDocumentTitle(t("allocation.writeOff.title"));
  if (!hasCenterScope(me.scope))
    return <InlineNotice tone="warning">{t("allocation.page.denied")}</InlineNotice>;
  return (
    <WriteOffWorkspace
      key={scope.context}
      scope={scope}
      route={WRITE_OFFS_ROUTE}
      kind="lot"
      titleKey="allocation.writeOff.title"
    />
  );
}
