import { useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { TableState } from "../data-table/table-types";
import type { FleetEvidence } from "./fleet-evidence";
import type { FleetCommand, OperationFailure } from "./fleet-operation";
export interface FleetDraft {
  intent: number;
  kind: "service" | "clear";
  motorcycle: string;
  center: string | null;
  revision: number;
  values: Record<string, string>;
  files: FleetEvidence[];
  fault?: Schemas["Incident"];
  sourceState?: TableState;
  phase: "idle" | "write" | "upload" | "review";
  failure?: OperationFailure | undefined;
  evidenceFailed?: boolean;
  evidenceInvalid?: boolean;
  command?: FleetCommand;
  invalidFields?: Record<string, boolean>;
  retryAt?: number;
  readback?: { context: string; revision: number };
}
/** Owned by the mounted motorcycle record, above its replaceable read/dialog subtree. Never storage. */
export function useFleetDraft() {
  const [draft, setDraft] = useState<FleetDraft>();
  const current = useRef<FleetDraft | undefined>(undefined);
  const generation = useRef(0);
  const write = (next: FleetDraft | undefined) => {
    current.current = next;
    setDraft(next);
  };
  const patch = (intent: number, update: (previous: FleetDraft) => FleetDraft) => {
    if (current.current?.intent === intent) write(update(current.current));
  };
  return {
    draft,
    read: () => current.current,
    write,
    patch,
    nextIntent: () => ++generation.current,
  };
}
export type FleetDraftStore = ReturnType<typeof useFleetDraft>;
