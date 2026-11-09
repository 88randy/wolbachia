import type { Schemas } from "@wolbachia/api-client";
import type { TableController } from "../data-table/table-types";
import { BagMetadata } from "./BagMetadata";
import { CountForm } from "./CountForm";
import { queueContext } from "./lab-query";
import type { Candidate, LabScope } from "./lab-query";
interface EditorProps {
  bag: Candidate; scope: LabScope; draftKey: string; controller: TableController;
  onLockChange: (locked: boolean) => void;
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
export function CountEditor(props: EditorProps) {
  return <>
    <BagMetadata key={props.bag.id} scope={props.scope} bag={props.bag} />
    <CountForm key={props.bag.id} scope={props.scope} bag={props.bag} storageKey={props.draftKey + ":" + props.bag.id}
      context={queueContext(props.scope, props.controller.state)} onSaved={props.onSaved} onLockChange={props.onLockChange} />
  </>;
}
