import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { incidentContextOptions } from "./incident-options-query";
import { incidentContextPatch, incidentContextValue } from "./incident-context-choices";
/** Named context choices publish only accepted pairs to the URL. */
export function useIncidentContextFilter(scope: IncidentScope, controller: TableController) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useQuery(incidentContextOptions(scope, { page, search }));
  const value = incidentContextValue(controller.state.filters, scope.identity.activeCenter);
  const select = (next: string) => {
    const patch = incidentContextPatch(query.data?.results ?? [], next);
    void navigate({ to: ".", search: (previous) => ({ ...previous, ...patch }) });
  };
  const searchFor = (next: string) => {
    setSearch(next);
    setPage(1);
  };
  return { page, setPage, search, searchFor, query, value, select };
}
