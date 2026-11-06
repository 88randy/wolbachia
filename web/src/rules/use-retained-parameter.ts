import { ApiError } from "@wolbachia/api-client";
import { useLayoutEffect, useRef } from "react";
import type { SessionIdentity } from "../session/org-scoped-query";
import { useCan } from "../session/use-can";
import { isSignedOutSession } from "../session/session-revision";
import { RULE_PARAMETER_READ } from "./permissions";
import type { RuleParameter } from "./rules-query";
interface ParameterResult {
  data: RuleParameter | undefined;
  error: Error | null;
}
interface ParameterSnapshot {
  scope: string;
  parameter: RuleParameter | undefined;
  isRetaining: boolean;
}
interface SnapshotOptions extends ParameterResult {
  scope: string;
  isBlocked: boolean;
}
const HTTP_UNAUTHORIZED = 401;
/** Answers that mean the user may no longer see this parameter: the draft is discarded. */
const HTTP_ACCESS_LOST: readonly number[] = [403, 404];
/** Transient failures (network, 429, 5xx, other 4xx) keep the draft; access loss drops it. */
function canRetainParameter(error: Error | null, isBlocked: boolean): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.status === HTTP_UNAUTHORIZED) return isBlocked;
  return !HTTP_ACCESS_LOST.includes(error.status);
}
function nextSnapshot(
  options: SnapshotOptions,
  previous: ParameterSnapshot | undefined,
): ParameterSnapshot {
  const isRetaining =
    options.isBlocked || (options.data === undefined && previous?.isRetaining === true);
  return {
    scope: options.scope,
    parameter: canRetainParameter(options.error, options.isBlocked)
      ? (options.data ?? (isRetaining ? previous?.parameter : undefined))
      : undefined,
    isRetaining,
  };
}
/** Keep the mounted editor across a blocked session, never repopulating cleared query caches. */
export function useRetainedParameter(
  identity: SessionIdentity,
  parameterKey: string,
  result: ParameterResult,
) {
  const canRead = useCan()(RULE_PARAMETER_READ) && !isSignedOutSession();
  const scope = `${identity.userId}|${identity.organizationSlug}|${parameterKey}`;
  const memory = useRef<ParameterSnapshot | undefined>(undefined);
  const previous = memory.current?.scope === scope ? memory.current : undefined;
  const next = nextSnapshot({ ...result, scope, isBlocked: !identity.isSettled }, previous);
  useLayoutEffect(() => {
    memory.current = canRead ? next : undefined;
  }, [canRead, next]);
  return { scope, parameter: canRead ? next.parameter : undefined };
}
