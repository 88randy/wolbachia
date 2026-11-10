import { LabListScreen } from "./LabListScreen";
import { RecountRowActions } from "./LabRowActions";
import { RECOUNT_TABLE, recountOptions } from "./lab-lists";
import { useRecountColumns } from "./use-lab-list-columns";
import { useRecountDetail } from "./use-lab-details";

/** W36 Recounts: bags another person must count again; every attempt is kept. */
export function W36Page() {
  return (
    <LabListScreen
      titleKey="lab.recounts.title"
      descriptionKey="lab.recounts.description"
      table={RECOUNT_TABLE}
      options={recountOptions}
      columns={useRecountColumns()}
      getRowId={(row) => row.id}
      detailOf={useRecountDetail()}
      rowActions={(row) => <RecountRowActions recount={row} />}
    />
  );
}
