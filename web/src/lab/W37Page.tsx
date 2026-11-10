import { LabListScreen } from "./LabListScreen";
import { PADDLE_TABLE, paddleOptions } from "./lab-lists";
import { usePaddleColumns } from "./use-lab-list-columns";

/** W37 Recycled egg paddles: washed and dried negative paddles. */
export function W37Page() {
  const columns = usePaddleColumns();
  return (
    <LabListScreen
      titleKey="lab.paddles.title"
      descriptionKey="lab.paddles.description"
      table={PADDLE_TABLE}
      options={paddleOptions}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}
