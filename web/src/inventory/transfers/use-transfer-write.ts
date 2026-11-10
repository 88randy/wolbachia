import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap, ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { reportSessionError } from "../../session/session-events";
import { InventoryRateLimit } from "../inventory-failure";
import type { TransferScope } from "./transfer-query";
export type TransferCommand =
  | { id: string; action: "dispatch"; body: Schemas["DispatchTransferRequest"] }
  | { id: string; action: "receive"; body: Schemas["ReceiveTransferRequest"] };
export interface TransferMemory {
  command?: TransferCommand;
  signature?: string;
  reception?: import("./transfer-reception").ReceptionDraft;
}
async function execute(scope: TransferScope, command: TransferCommand, signal: AbortSignal) {
  const params = { path: { id: command.id } };
  const response =
    command.action === "dispatch"
      ? await scope.client.POST("/api/v1/transfers/{id}/dispatch/", {
          params,
          body: command.body,
          signal,
        })
      : await scope.client.POST("/api/v1/transfers/{id}/receive/", {
          params,
          body: command.body,
          signal,
        });
  if (response.response.status === 429)
    throw new InventoryRateLimit(response.response, response.error);
  return unwrap(response);
}
type Runtime = ReturnType<typeof useRuntime>;
function isCurrentOperation(runtime: Runtime, guard: ReturnType<TransferScope["beginWrite"]>) {
  return !guard.isStale() && runtime.scope.isCurrentRead();
}
function useRuntime(scope: TransferScope, memory: TransferMemory) {
  const cache = useQueryClient();
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [result, setResult] = useState<Schemas["TransferEvent"]>();
  return { scope, memory, cache, busy, isBusy, setBusy, failure, setFailure, result, setResult };
}
function publishFailure(runtime: Runtime, error: unknown) {
  runtime.setFailure(error);
  reportSessionError(error, runtime.cache);
  if (error instanceof ApiError && error.status === 409)
    void invalidateOrgScoped(runtime.cache, "transfers");
}
async function perform(runtime: Runtime, command: TransferCommand) {
  const { scope, memory } = runtime;
  const guard = scope.beginWrite();
  if (guard.isStale()) return;
  memory.command ??= structuredClone(command);
  runtime.busy.current = true;
  runtime.setBusy(true);
  runtime.setFailure(undefined);
  try {
    const receipt = await execute(scope, memory.command, guard.signal);
    if (!isCurrentOperation(runtime, guard)) return;
    runtime.setResult(receipt);
    void invalidateOrgScoped(runtime.cache, "transfers");
    void invalidateOrgScoped(runtime.cache, "inventory");
  } catch (error) {
    if (isCurrentOperation(runtime, guard)) publishFailure(runtime, error);
  } finally {
    runtime.busy.current = false;
    if (isCurrentOperation(runtime, guard)) runtime.setBusy(false);
  }
}
async function reviewCurrent(runtime: Runtime) {
  const { scope, memory } = runtime;
  if (!memory.command || runtime.busy.current || !scope.isCurrentRead()) return;
  const guard = scope.beginWrite();
  try {
    unwrap(
      await scope.client.GET("/api/v1/transfers/{id}/", {
        params: { path: { id: memory.command.id } },
        signal: guard.signal,
      }),
    );
    if (!isCurrentOperation(runtime, guard)) return;
    await invalidateOrgScoped(runtime.cache, "transfers");
    if (!isCurrentOperation(runtime, guard)) return;
    delete memory.command;
    runtime.setFailure(undefined);
  } catch (error) {
    if (isCurrentOperation(runtime, guard)) publishFailure(runtime, error);
  }
}
/** The first submitted body is immutable; only an explicit retry can resend that command UUID. */
export function useTransferWrite(scope: TransferScope, memory: TransferMemory) {
  const runtime = useRuntime(scope, memory);
  const send = (command: TransferCommand) => {
    if (
      runtime.busy.current ||
      !scope.identity.isSettled ||
      !scope.isCurrentRead() ||
      !navigator.onLine
    )
      return Promise.resolve();
    return perform(runtime, command);
  };
  return {
    send,
    isBusy: runtime.isBusy,
    failure: runtime.failure,
    result: runtime.result,
    isFrozen: memory.command !== undefined,
    review: () => reviewCurrent(runtime),
  };
}
