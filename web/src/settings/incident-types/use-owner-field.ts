import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ownerSelectionOptions, ownersOptions } from "./incident-types-query";
import type { TypeScope } from "./incident-types-query";
import type { OwnerFieldProps } from "./owner-field-types";
export function useOwnerField(props: OwnerFieldProps & { scope: TypeScope }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery(ownersOptions(props.scope, { search, page }));
  const selected = useQuery(ownerSelectionOptions(props.scope, props.value));
  const eligible =
    selected.data?.results.some(
      (owner) =>
        owner.membership_id === props.value && (!props.isTerminal || owner.is_terminal_eligible),
    ) === true &&
    !selected.isFetching &&
    !selected.error;
  useEffect(() => {
    props.onEligibility(eligible || (!props.isTerminal && !props.value));
  }, [eligible, props]);
  function searchChanged(value: string) {
    setSearch(value);
    setPage(1);
  }
  return { search, page, setPage, query, selected, eligible, searchChanged };
}
export type OwnerFieldController = ReturnType<typeof useOwnerField>;
