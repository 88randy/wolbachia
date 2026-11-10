import { useEffect } from "react";
import { ApiError } from "@wolbachia/api-client";
import { useQuery } from "@tanstack/react-query";
import { relocationRecordOptions } from "./relocations-query";
import type { RelocationDecisionProps } from "./RelocationDecision";
import { useRelocationCommand } from "./use-relocation-command";
/** Reasons stay above replaced reads. Fresh matching evidence must precede every explicit retry. */
export function useRelocationRecord({ scope, code, onReasonChange }: RelocationDecisionProps) {
  const query = useQuery(relocationRecordOptions(scope, code));
  const command = useRelocationCommand(scope);
  const isInaccessible =
    (query.isSuccess && !query.isPlaceholderData && query.data === null) ||
    (query.isError && query.error instanceof ApiError && [403, 404].includes(query.error.status));
  useEffect(() => {
    if (isInaccessible) onReasonChange("");
  }, [isInaccessible, onReasonChange]);
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isSuccess && result.data?.code === code) command.clearFailure();
  };
  return { query, command, refresh };
}
