import { useQuery } from "@tanstack/react-query";
import { EmptyValue } from "../ui/EmptyValue";
import { nameOptions } from "./lab-names";
import type { NameKind } from "./lab-names";
import { useLabScope } from "./use-lab-scope";

interface LabNameProps {
  kind: NameKind;
  id: string | null | undefined;
}

/** A record shown by name (never by id); "—" when it cannot be resolved. */
export function LabName({ kind, id }: LabNameProps) {
  const scope = useLabScope();
  const query = useQuery({
    ...nameOptions(scope, kind, id ?? ""),
    enabled: Boolean(id) && scope.identity.isSettled,
  });
  if (!id || query.isError) return <EmptyValue />;
  return <span>{query.data ?? "…"}</span>;
}
