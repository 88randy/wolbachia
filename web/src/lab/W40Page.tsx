import { useCan } from "../session/use-can";
import { LabListScreen } from "./LabListScreen";
import { RecordResultDialog } from "./RecordResultDialog";
import { ReceiveSampleButton } from "./ReceiveSampleButton";
import { SAMPLE_TABLE, sampleOptions } from "./lab-lists";
import { useSampleColumns } from "./use-lab-list-columns";

/** W40 Wolbachia results: receive samples, record attempts; an invalid one is repeated, not replaced. */
export function W40Page() {
  const columns = useSampleColumns();
  const can = useCan();
  return (
    <LabListScreen
      titleKey="lab.results.title"
      descriptionKey="lab.results.description"
      table={SAMPLE_TABLE}
      options={sampleOptions}
      columns={columns}
      getRowId={(row) => row.id}
      rowActions={(row) => {
        if (row.voided) return null;
        if (!row.receipt)
          return can("sample.receive") ? <ReceiveSampleButton sample={row} /> : null;
        if (row.result_status !== "missing" && row.result_status !== "invalid") return null;
        return can("sample.result_create") ? <RecordResultDialog sample={row} /> : null;
      }}
    />
  );
}
