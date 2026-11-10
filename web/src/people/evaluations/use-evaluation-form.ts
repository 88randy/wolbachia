import { useMe } from "../../session/use-me";
import { useOnlineStatus } from "../../shell/use-online-status";
import { readRubric, isContextAllowed } from "./evaluation-domain";
import { invalidFields } from "./evaluation-validation";
import { useEvaluationCommand } from "./use-evaluation-command";
import { useEvaluationDraft } from "./use-evaluation-draft";
import { useEvaluationDraftScope } from "./use-evaluation-draft-scope";
import type { EvaluationScope } from "./evaluation-query";
interface Runtime {
  scope: EvaluationScope;
  draft: ReturnType<typeof useEvaluationDraft>;
  command: ReturnType<typeof useEvaluationCommand>;
  isBlocked: boolean;
  isOnline: boolean;
}
function reviewEvaluation(runtime: Runtime) {
  runtime.draft.setSubmitted(true);
  if (runtime.isBlocked || !runtime.isOnline || invalidFields(runtime.draft.draft).length > 0)
    return false;
  runtime.draft.freeze({
    revision: runtime.scope.identity.revision,
    context: runtime.command.context,
  });
  return true;
}
function sendEvaluation(runtime: Runtime) {
  const reviewed = runtime.draft.reviewed;
  if (
    reviewed?.revision !== runtime.scope.identity.revision ||
    reviewed.context !== runtime.command.context
  ) {
    runtime.command.requireReview();
    return;
  }
  if (!runtime.isBlocked && runtime.isOnline) void runtime.command.send(reviewed.body);
}
function resetEvaluation(runtime: Runtime) {
  runtime.command.reset();
  runtime.draft.clear();
}
function evaluationFormModel(runtime: Runtime) {
  return {
    ...runtime.draft,
    isBlocked: runtime.isBlocked,
    isOnline: runtime.isOnline,
    command: runtime.command,
    review: () => reviewEvaluation(runtime),
    send: () => {
      sendEvaluation(runtime);
    },
    newRecord: () => {
      resetEvaluation(runtime);
    },
  };
}
/** Permitted RAM drafts survive refresh and same-identity reauthentication. */
export function useEvaluationForm(scope: EvaluationScope) {
  const me = useMe();
  const isOnline = useOnlineStatus();
  const draft = useEvaluationDraft();
  const command = useEvaluationCommand(scope, draft.clear);
  const isAllowed = isContextAllowed(
    me.scope,
    draft.draft.center.trim(),
    draft.draft.quadrant.trim(),
  );
  const isBlocked =
    !draft.version || !readRubric(draft.version) || !isAllowed || !scope.identity.isSettled;
  const runtime = { scope, draft, command, isBlocked, isOnline };
  useEvaluationDraftScope({
    context: command.context,
    draft: draft.draft,
    isAllowed,
    retire: () => {
      resetEvaluation(runtime);
    },
  });
  return evaluationFormModel(runtime);
}
export type EvaluationFormModel = ReturnType<typeof useEvaluationForm>;
