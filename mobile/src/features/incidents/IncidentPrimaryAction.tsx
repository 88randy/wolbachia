import { IncidentBeginAction } from "./IncidentBeginAction.tsx";
import { IncidentSaveAction } from "./IncidentSaveAction.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentPrimaryAction({ model, kind }: Props) {
  const state = model.state;
  if (state?.draft?.kind !== kind || state.event)
    return <IncidentBeginAction model={model} kind={kind} />;
  return (
    <>
      <IncidentSaveAction model={model} />
      {!state.ready && state.canBegin ? <IncidentBeginAction model={model} kind={kind} /> : null}
    </>
  );
}
