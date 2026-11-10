import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { operationTableData } from "../../operations/read-access";
import { useMe } from "../../session/use-me";
import { TRAINING_PAGE_SIZE } from "./training-query";
import type { TrainingScope } from "./training-query";
import type { PersonContext } from "./person-context";
import { RequirementPublish } from "./RequirementPublish";
import { useRequirementTable } from "./use-requirement-table";
interface Props {
  scope: TrainingScope;
  context: PersonContext;
}
export function RequirementList({ scope, context }: Props) {
  const { t } = useTranslation();
  const canManage = useMe().permissions.includes("training.manage");
  const { table, query, columns, isFresh } = useRequirementTable(scope, context);
  const rowActions = canManage
    ? (requirement: Parameters<typeof RequirementPublish>[0]["requirement"]) => (
        <RequirementPublish
          scope={scope}
          context={context}
          requirement={requirement}
          isFresh={isFresh}
        />
      )
    : undefined;
  return (
    <>
      {canManage && <RequirementPublish scope={scope} context={context} isFresh={isFresh} />}
      <DataTable
        embedded
        caption={t("trainings.requirement.title")}
        columns={columns}
        controller={table}
        getRowId={(row) => row.id}
        data={operationTableData(query, table.state.page, TRAINING_PAGE_SIZE)}
        rowActions={rowActions}
      />
    </>
  );
}
