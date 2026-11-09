import { Link, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { HistoryTab } from "./fleet-history-table";
import { HISTORY_PREFIX } from "./fleet-history-table";
/** The actual source UUID opens its owning tab; it is not an invented off-page lookup. */
export function FleetSourceLink({
  code,
  target,
  children,
}: {
  code: string;
  target: { tab: HistoryTab; id?: string };
  children: ReactNode;
}) {
  const search = useSearch({ strict: false });
  return (
    <Link
      to="/fleet/motorcycles/$code"
      params={{ code }}
      search={{
        ...search,
        tab: target.tab,
        ...(target.id ? { [HISTORY_PREFIX[target.tab] + "source"]: target.id } : {}),
      }}
    >
      {children}
    </Link>
  );
}
