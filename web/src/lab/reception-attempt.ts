import type { QueryClient } from "@tanstack/react-query";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import type { SessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { postReception } from "./reception-command";
import type { ReceptionCommand, ReceptionResult } from "./reception-command";
import type { ReceptionScope } from "./reception-query";
import { receptionFailure } from "./reception-result";

export interface ReceptionAttemptContext {
  scope: ReceptionScope;
  cache: QueryClient;
  begin: () => SessionGuard;
  token: { current: symbol | null };
  publish: (result: ReceptionResult | null) => void;
  setBusy: (busy: boolean) => void;
}
interface ReceptionAttempt {
  token: symbol;
  guard: SessionGuard;
}

function startReception(context: ReceptionAttemptContext): ReceptionAttempt | null {
  if (context.token.current || !context.scope.identity.isSettled) return null;
  const guard = context.begin();
  if (guard.isStale()) return null;
  const token = Symbol();
  context.token.current = token;
  context.setBusy(true);
  return { token, guard };
}

function finishReception(context: ReceptionAttemptContext, attempt: ReceptionAttempt) {
  if (context.token.current !== attempt.token || attempt.guard.isStale()) return;
  context.token.current = null;
  context.setBusy(false);
}

function publishFailure(
  context: ReceptionAttemptContext,
  guard: SessionGuard,
  failure: { error: unknown; subject: string },
) {
  if (guard.isStale()) return;
  context.publish({ ...receptionFailure(failure.error), subject: failure.subject });
  reportSessionError(failure.error, context.cache);
}

/** One token owns an explicit command and may publish only in its original session. */
export async function executeReception(
  context: ReceptionAttemptContext,
  command: ReceptionCommand,
) {
  const attempt = startReception(context);
  if (!attempt) return false;
  try {
    const result = await postReception(context.scope.client, command, attempt.guard.signal);
    if (attempt.guard.isStale()) return false;
    context.publish({ ...result, subject: command.kind === "bag" ? command.code : command.id });
    void invalidateOrgScoped(context.cache, "lab-reception");
    return result.code === "received" || result.code === "lab_missing";
  } catch (error) {
    publishFailure(context, attempt.guard, {
      error,
      subject: command.kind === "bag" ? command.code : command.id,
    });
    return false;
  } finally {
    finishReception(context, attempt);
  }
}

/** Reviewing refreshes current reads without replaying the uncertain command. */
export async function reviewReception(context: ReceptionAttemptContext) {
  const attempt = startReception(context);
  if (!attempt) return;
  try {
    await context.cache.refetchQueries(
      { predicate: (query) => query.queryKey[3] === "lab-reception", type: "active" },
      { throwOnError: true },
    );
    if (!attempt.guard.isStale()) context.publish(null);
  } catch (error) {
    if (!attempt.guard.isStale()) context.publish(receptionFailure(error));
  } finally {
    finishReception(context, attempt);
  }
}
