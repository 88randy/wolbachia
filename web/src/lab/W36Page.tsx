import { useCan } from "../session/use-can";
import { ClaimRecountDialog } from "./ClaimRecountDialog";
import { LabListScreen } from "./LabListScreen";
import { RECOUNT_TABLE, recountOptions } from "./lab-lists";
import { useRecountColumns } from "./use-lab-list-columns";

/** W36 Recounts: bags another person must count again; every attempt is kept. */
export function W36Page() {
  const columns = useRecountColumns();
  const canClaim = useCan()("recount.create");
  return (
    <LabListScreen
      titleKey="lab.recounts.title"
      descriptionKey="lab.recounts.description"
      table={RECOUNT_TABLE}
      options={recountOptions}
      columns={columns}
      getRowId={(row) => row.id}
      rowActions={(row) =>
        canClaim && (row.state === "awaiting_second" || row.state === "awaiting_third") ? (
          <ClaimRecountDialog recount={row} />
        ) : null
      }
    />
  );
}
