import { useEffect, useReducer } from "react";
import { ApiError } from "@wolbachia/api-client";
import type { Transfer, TransferScope } from "./transfer-query";
import type { TransferMemory } from "./use-transfer-write";
interface RecordRead {
  isPending: boolean;
  isPlaceholderData: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  error: unknown;
  data: Transfer | null | undefined;
}
interface RetirementContext {
  scope: TransferScope;
  memory: TransferMemory;
  query: RecordRead;
  code: string;
}
function hasDeniedRead(query: RecordRead, code: string) {
  if (query.isPending || query.isPlaceholderData || query.isFetching) return false;
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) return true;
  return query.isSuccess && query.data?.code !== code;
}
function hasDraftPermission(scope: TransferScope, memory: TransferMemory) {
  const action =
    memory.command?.action ??
    (memory.reception ? "receive" : memory.signature !== undefined ? "dispatch" : undefined);
  return !action || (scope.identity.permissions ?? []).includes(`transfer.${action}`);
}
/** Scope changes mask private memory until current reads authorize it; denial retires it permanently. */
export function useTransferRetirement({ scope, memory, query, code }: RetirementContext) {
  const [epoch, advanceEpoch] = useReducer((current: number) => current + 1, 0);
  const shouldRetire = hasDeniedRead(query, code) || !hasDraftPermission(scope, memory);
  useEffect(() => {
    if (!scope.identity.isSettled || !shouldRetire || Object.keys(memory).length === 0) return;
    delete memory.command;
    delete memory.signature;
    delete memory.reception;
    advanceEpoch();
  }, [memory, scope.identity.isSettled, shouldRetire]);
  return epoch;
}
