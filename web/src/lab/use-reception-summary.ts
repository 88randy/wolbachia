import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TableState } from "../data-table/table-types";
import { receptionCountOptions } from "./reception-query";
import { useReceptionScope } from "./use-reception-scope";

export interface ReceptionSummaryCountProps {
  state: TableState;
  kind: "received" | "expected";
}

/** Each counter opens the exact server-filtered list that supplied its value. */
export function useReceptionSummary({ state, kind }: ReceptionSummaryCountProps) {
  const { i18n } = useTranslation();
  const scope = useReceptionScope();
  const search = useSearch({ strict: false });
  const query = useQuery(receptionCountOptions(scope, state, kind));
  return {
    labelKey:
      kind === "received"
        ? ("labReception.summary.received" as const)
        : ("labReception.summary.expected" as const),
    error: query.error,
    value:
      query.data === undefined
        ? undefined
        : new Intl.NumberFormat(i18n.language).format(query.data),
    isRefreshing: query.isFetching && query.data !== undefined,
    search: () =>
      Object.fromEntries(
        Object.entries({ ...search, view: kind }).filter(([key]) => key !== "page"),
      ),
    retry: () => {
      void query.refetch();
    },
  };
}
