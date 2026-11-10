import { useTranslation } from "react-i18next";
import { hasCenterScope } from "../../centers/center-selection";
import { useMe } from "../../session/use-me";
import { can } from "../../session/can";
import { useDocumentTitle } from "../../shell/use-document-title";
import { ListPage } from "../../components/templates/ListPage";
import { InfoHint } from "../../ui/InfoHint";
import { InlineNotice } from "../../ui/InlineNotice";
import { useInventoryContext } from "../use-inventory-context";
import { AssignmentDateField } from "./AssignmentDateField";
import { AssignmentWorkspace } from "./AssignmentWorkspace";
import { useAssignmentRoute } from "./use-assignment-route";

/** W15 assignment to couriers. A scope or session change remounts the workspace and drops old data. */
export function W15Page() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const me = useMe();
  const route = useAssignmentRoute();
  useDocumentTitle(t("allocation.assignment.title"));
  if (!hasCenterScope(me.scope))
    return <InlineNotice tone="warning">{t("allocation.page.denied")}</InlineNotice>;
  return (
    <ListPage
      title={t("allocation.assignment.title")}
      description={
        <>
          {t("allocation.assignment.description")}
          <InfoHint text={t("allocation.assignment.hint")} />
        </>
      }
      actions={<AssignmentDateField date={route.date} onChange={route.setDate} />}
    >
      <AssignmentWorkspace
        key={scope.context}
        scope={scope}
        date={route.date}
        courierId={route.courierId}
        canAllocate={can(me, "inventory.allocate")}
      />
    </ListPage>
  );
}
