import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { TableController } from "../data-table/table-types";
import { queueOptions } from "./lab-query";
import type { Candidate, LabScope } from "./lab-query";
export interface CountWorkspaceOptions {
  scope: LabScope;
  controller: TableController;
  initial: Candidate | null;
}
/** Pin the active bag across refreshes and advance only on a server-confirmed result. */
export function useCountWorkspace({ scope, controller, initial }: CountWorkspaceOptions) {
  const query = useQuery(queueOptions(scope, controller.state));
  const [bag, select] = useState(initial);
  const [savedCode, setSavedCode] = useState<string>();
  const [isLocked, setLocked] = useState(false);
  const retry = async () => {
    const answer = await query.refetch();
    if (answer.data) select(answer.data.results[0] ?? null);
  };
  const onSaved = (outcome: Schemas["LabCountOutcome"]) => {
    setLocked(false);
    select(outcome.next_bag);
    setSavedCode(bag?.code);
  };
  return { bag, select, savedCode, isLocked, setLocked, retry, onSaved };
}
