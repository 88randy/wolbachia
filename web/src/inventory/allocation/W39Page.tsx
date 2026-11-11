import { useTranslation } from "react-i18next";
import { hasCenterScope } from "../../centers/center-selection";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryContext } from "../use-inventory-context";
import { LAB_WRITE_OFFS_ROUTE } from "./allocation-query";
import { WriteOffWorkspace } from "./WriteOffWorkspace";

/** W39 lab biological write-offs: the same shared form and server behavior as W17. */
export function W39Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const me = useMe();
  useDocumentTitle(t("allocation.lab.title"));
  if (!hasCenterScope(me.scope))
    return <InlineNotice tone="warning">{t("allocation.page.denied")}</InlineNotice>;
  return (
    <WriteOffWorkspace
      key={scope.context}
      scope={scope}
      route={LAB_WRITE_OFFS_ROUTE}
      kind="bag"
      titleKey="allocation.lab.title"
    />
  );
}
