import type { Schemas } from "@wolbachia/api-client";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
interface Props {
  readonly type: Schemas["IncidentType"];
  readonly isSelected: boolean;
  readonly choose: (id: string) => void;
}
export function IncidentTypeOption({ type, isSelected, choose }: Props) {
  return (
    <ShiftAction
      label={type.label}
      selected={isSelected}
      onPress={() => {
        choose(type.current_version_id);
      }}
    />
  );
}
