import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { useApiClient } from "../api/ApiClientProvider";
import { useFocusAlert } from "../forms/use-focus-alert";
import { useSessionGuard } from "../session/use-session-guard";
import { createVersion } from "./create-version";
import type { FieldIssue, ServerBounds, VersionField, VersionOutcome } from "./create-version";
import { invalidateRuleParameters } from "./rules-query";
import type { RuleParameter } from "./rules-query";
import { boundsOf, createVersionSchema } from "./version-schema";
import type { VersionValues } from "./version-schema";

const FIELD_ORDER: readonly VersionField[] = ["value", "effectiveFrom", "reason"];
const EMPTY: VersionValues = { value: "", effectiveFrom: "", reason: "" };

/** A refusal that is not about one field: shown in the form's alert. */
type Refusal = Exclude<VersionOutcome, { ok: true } | { reason: "fields" | "stale" }>;

/** What the last submit left: nothing, a saved version, field errors or a refusal. */
type Result =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "fields"; bounds: ServerBounds | undefined }
  | { kind: "refused"; refusal: Refusal };

const IDLE: Result = { kind: "idle" };

/** Marks each refused field and focuses the first one; returns the limits the server reported. */
function showFieldIssues(
  form: UseFormReturn<VersionValues>,
  issues: Partial<Record<VersionField, FieldIssue>>,
): ServerBounds | undefined {
  const shown = FIELD_ORDER.filter((field) => issues[field] !== undefined);
  shown.forEach((field, index) => {
    const message = issues[field]?.key;
    const error = { type: "server", ...(message === undefined ? {} : { message }) };
    form.setError(field, error, { shouldFocus: index === 0 });
  });
  return issues.value?.bounds;
}

/**
 * What the form does with the answer. A saved version empties the form and refreshes every query
 * of the rules (the list, the parameter and its history) before it says so.
 */
async function settle(
  outcome: VersionOutcome,
  form: UseFormReturn<VersionValues>,
  queryClient: QueryClient,
): Promise<Result | undefined> {
  // A stale answer changes nothing: no form reset, no refresh, no message.
  if (!outcome.ok && outcome.reason === "stale") return undefined;
  if (outcome.ok) {
    form.reset(EMPTY);
    await invalidateRuleParameters(queryClient);
    return { kind: "saved" };
  }
  if (outcome.reason === "fields") {
    return { kind: "fields", bounds: showFieldIssues(form, outcome.issues) };
  }
  return { kind: "refused", refusal: outcome };
}

/** `POST /rule-parameters/{key}/versions/` with the form's values. */
function useSendVersion(parameterKey: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  return (values: VersionValues) => {
    const { signal, isStale } = begin();
    const send = () =>
      client.POST("/api/v1/rule-parameters/{parameter_key}/versions/", {
        params: { path: { parameter_key: parameterKey } },
        body: {
          value: values.value.trim(),
          effective_from: values.effectiveFrom,
          reason: values.reason.trim(),
        },
        signal,
      });
    return createVersion(queryClient, send, isStale);
  };
}

/** Validated on blur (and again on every change after that) against the parameter's limits. */
function useVersionForm(parameter: RuleParameter) {
  const schema = useMemo(() => createVersionSchema(boundsOf(parameter)), [parameter]);
  return useForm<VersionValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: "onBlur",
  });
}

/** What the form shows of the last result. */
function viewOf(result: Result) {
  return {
    refusal: result.kind === "refused" ? result.refusal : undefined,
    serverBounds: result.kind === "fields" ? result.bounds : undefined,
    isSaved: result.kind === "saved",
  };
}

/**
 * State of the "new version" form: validation against the parameter's limits, the request, the
 * server's field errors mapped onto the fields (`out_of_range` keeps the limits it sent) and the
 * failures that are not about a field. A second submit while one is in flight is ignored.
 */
export function useNewVersionForm(parameter: RuleParameter) {
  const queryClient = useQueryClient();
  const send = useSendVersion(parameter.key);
  const form = useVersionForm(parameter);
  const [result, setResult] = useState<Result>(IDLE);
  const view = viewOf(result);
  const isSending = useRef(false);
  const submit = form.handleSubmit(async (values) => {
    if (isSending.current) return;
    isSending.current = true;
    setResult(IDLE);
    const outcome = await send(values);
    isSending.current = false;
    const next = await settle(outcome, form, queryClient);
    if (next !== undefined) setResult(next);
  });
  const onSubmit = (event: SyntheticEvent) => {
    void submit(event);
  };
  return {
    form,
    submit: onSubmit,
    alertRef: useFocusAlert(view.refusal),
    ...view,
    isBusy: form.formState.isSubmitting,
  };
}
