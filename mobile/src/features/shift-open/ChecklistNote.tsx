import { useT } from "../../i18n/I18nProvider.tsx";
import type { Check, ChecklistItem } from "./domain.ts";
import { ShiftField } from "./ShiftField.tsx";
interface Props {
  readonly item: ChecklistItem;
  readonly check: Check;
  readonly onChange: (check: Check) => void;
}
export function ChecklistNote({ item, check, onChange }: Props) {
  const t = useT();
  const key =
    item.is_other || check.result === "severe"
      ? "mobile.shiftOpen.requiredNote"
      : "mobile.shiftOpen.note";
  return (
    <ShiftField
      label={t(key)}
      value={check.note ?? ""}
      onChange={(note) => {
        onChange({ ...check, note });
      }}
    />
  );
}
