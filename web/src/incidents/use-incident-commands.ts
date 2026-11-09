import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { postIncidentCommand, incidentFailure } from "./incident-command";
import type { IncidentCommand } from "./incident-command";
import type { IncidentScope } from "./incidents-query";
type Failure = ReturnType<typeof incidentFailure>;
interface CommandContext {
 scope: IncidentScope; id: string; begin: ReturnType<typeof useSessionGuard>;
 cache: ReturnType<typeof useQueryClient>; locked: { current: symbol | null };
 setBusy: (busy: boolean) => void; setFailure: (failure: Failure | null) => void;
}
async function execute(context: CommandContext, command: IncidentCommand) {
 const { scope, locked, cache } = context;
 if (locked.current || !scope.identity.isSettled) return false;
 const guard = context.begin();
 if (guard.isStale()) return false;
 const token = Symbol();
 locked.current = token;
 context.setBusy(true);
 try {
 await postIncidentCommand(scope.client, { id: context.id, signal: guard.signal }, command);
 if (guard.isStale()) return false;
 await invalidateOrgScoped(cache, "incidents");
 return !guard.isStale();
 } catch (error) {
 if (!guard.isStale()) {
 context.setFailure(incidentFailure(error));
 reportSessionError(error, cache);
 }
 return false;
 } finally {
 if (locked.current === token && !guard.isStale()) {
 locked.current = null;
 context.setBusy(false);
 }
 }
}
/** Unmount aborts writes; a synchronous gate prevents duplicate clicks before React renders. */
export function useIncidentCommands(scope: IncidentScope, id: string) {
 const begin = useSessionGuard();
 const cache = useQueryClient();
 const locked = useRef<symbol | null>(null);
 const previousRevision = useRef(scope.identity.revision);
 const [isBusy, setBusy] = useState(false);
 const [failure, setFailure] = useState<Failure | null>(null);
 useEffect(() => {
 if (previousRevision.current !== scope.identity.revision && isBusy) {
 locked.current = null;
 setBusy(false);
 setFailure("uncertain");
 }
 previousRevision.current = scope.identity.revision;
 }, [scope.identity.revision, isBusy]);
 const context = { scope, id, begin, cache, locked, setBusy, setFailure };
 return { isBusy, failure, clearFailure: () => { setFailure(null); },
 submit: (command: IncidentCommand) => failure ? Promise.resolve(false) : execute(context, command) };
}
