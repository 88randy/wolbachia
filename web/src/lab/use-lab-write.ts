import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { useSessionGuard } from "../session/use-session-guard";
import type { SessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { currentRevision } from "../session/session-revision";
import { labFailure } from "./lab-failure";
import type { LabFailure } from "./lab-failure";
import type { LabScope } from "./lab-query";
export type LabCommand =
  | { kind: "count"; id: string; body: Schemas["CountWriteRequest"] }
  | { kind: "void"; id: string; body: Schemas["LabVoidRequest"] };
async function sendCommand(scope: LabScope, command: LabCommand, signal: AbortSignal) {
  const params = { path: { id: command.id } };
  if (command.kind === "count")
    return unwrap(
      await scope.client.POST("/api/v1/bags/{id}/counts/", { params, body: command.body, signal }),
    );
  return unwrap(
    await scope.client.POST("/api/v1/egg-counts/{id}/void/", {
      params,
      body: command.body,
      signal,
    }),
  );
}
interface WriteContext {
  scope: LabScope;
  cache: ReturnType<typeof useQueryClient>;
  guard: SessionGuard;
  setFailure: (failure: LabFailure | undefined) => void;
}
/** Only a currently authorized session receives results or invalidations. */
async function receiveCommand(context: WriteContext, command: LabCommand) {
  try {
    const result = await sendCommand(context.scope, command, context.guard.signal);
    if (context.guard.isStale()) return undefined;
    void invalidateOrgScoped(context.cache, "lab");
    return result;
  } catch (error) {
    if (!context.guard.isStale()) {
      context.setFailure(labFailure(error));
      reportSessionError(error, context.cache);
    }
    return undefined;
  }
}
function useWriteState(scope: LabScope, onBusy?: (busy: boolean) => void) {
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const busy = useRef(false);
  const pending = useRef<LabCommand | undefined>(undefined);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<LabFailure>();
  const markBusy = (value: boolean) => {
    setBusy(value);
    onBusy?.(value);
  };
  return { scope, begin, cache, busy, pending, isBusy, markBusy, failure, setFailure };
}
async function performWrite(state: ReturnType<typeof useWriteState>, command: LabCommand) {
  if (
    state.busy.current ||
    !state.scope.identity.isSettled ||
    state.scope.identity.revision !== currentRevision()
  )
    return undefined;
  const guard = state.begin();
  if (guard.isStale()) return undefined;
  state.busy.current = true;
  state.pending.current = command;
  state.markBusy(true);
  state.setFailure(undefined);
  try {
    return await receiveCommand({ ...state, guard }, command);
  } finally {
    state.busy.current = false;
    if (!guard.isStale()) state.markBusy(false);
  }
}
/** A synchronous mutex prevents double Enter; retry reuses the complete last command. */
export function useLabWrite(scope: LabScope, onBusy?: (busy: boolean) => void) {
  const state = useWriteState(scope, onBusy);
  const send = (command: LabCommand) => performWrite(state, command);
  const retry = () =>
    state.pending.current ? send(state.pending.current) : Promise.resolve(undefined);
  return {
    send,
    retry,
    isBusy: state.isBusy,
    failure: state.failure,
    clearFailure: () => {
      state.setFailure(undefined);
    },
  };
}
