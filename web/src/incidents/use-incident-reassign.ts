import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { incidentOwnerOptions } from "./incident-owner-options";
import type { IncidentScope } from "./incidents-query";
import type { IncidentActionProps } from "./IncidentComment";

type ReassignProps = IncidentActionProps & { scope: IncidentScope };
interface OwnerCapture {
  owner: string;
  search: string;
  page: number;
}
function reassignActions(
  props: ReassignProps,
  capture: OwnerCapture,
  setCapture: Dispatch<SetStateAction<OwnerCapture>>,
) {
  return {
    searchOwners: (search: string) => {
      setCapture({ owner: "", search, page: 1 });
    },
    selectOwner: (owner: string) => {
      setCapture({ ...capture, owner });
    },
    changePage: (page: number) => {
      setCapture({ ...capture, owner: "", page });
    },
    reassign: () => {
      void props.submit({
        action: "reassign",
        body: { expected_revision: props.incident.revision, owner_id: capture.owner },
      });
    },
  };
}
/** Owner options and draft selection stay scoped to this incident and server page. */
export function useIncidentReassign(props: ReassignProps) {
  const [capture, setCapture] = useState<OwnerCapture>({ owner: "", search: "", page: 1 });
  const target = {
    id: props.incident.id,
    page: capture.page,
    search: capture.search,
    isOpen: props.incident.action_prerequisites?.is_open === true,
  };
  const query = useQuery(incidentOwnerOptions(props.scope, target));
  return {
    query,
    capture,
    ...reassignActions(props, capture, setCapture),
    retry: () => {
      void query.refetch();
    },
    isBlocked:
      props.isBlocked ||
      !capture.owner ||
      !query.data?.results.some((item) => item.membership_id === capture.owner),
  };
}
export type IncidentReassignment = ReturnType<typeof useIncidentReassign>;
