import { IncidentCloseAction } from "./IncidentCloseAction.tsx";
import { IncidentPrimaryAction } from "./IncidentPrimaryAction.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
  readonly closeShift?: () => void;
}
export function IncidentFooter(props: Props) {
  return (
    <>
      <IncidentPrimaryAction model={props.model} kind={props.kind} />
      <IncidentCloseAction model={props.model} kind={props.kind} closeShift={props.closeShift} />
    </>
  );
}
