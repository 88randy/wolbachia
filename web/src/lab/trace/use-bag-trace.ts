import { useQuery } from "@tanstack/react-query";
import { useCan } from "../../session/use-can";
import { useLabScope } from "../use-lab-scope";
import { traceOptions } from "./trace-query";

/** Origin of the bag; it never blocks the screen it sits in and is off without `reading.read`. */
export function useBagTrace(code: string | null | undefined) {
  const scope = useLabScope();
  const canRead = useCan()("reading.read");
  return useQuery({
    ...traceOptions(scope, code ?? ""),
    enabled: Boolean(code) && canRead && scope.identity.isSettled,
    staleTime: 30_000,
  });
}
