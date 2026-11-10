import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { EMPTY_DRAFT, readRubric, evaluationBody } from "./evaluation-domain";
import type { EvaluationDraft } from "./evaluation-domain";
import type { RubricVersion } from "./evaluation-query";
interface Reviewed {
  body: Schemas["EvaluationCreateRequest"];
  revision: number;
  context: string;
}
interface State {
  draft: EvaluationDraft;
  version: RubricVersion | null;
  setDraft: Dispatch<SetStateAction<EvaluationDraft>>;
  setVersion: (version: RubricVersion) => void;
  setReviewed: (reviewed: Reviewed | null) => void;
  setSubmitted: (submitted: boolean) => void;
}
function blankDraft(version: RubricVersion | null): EvaluationDraft {
  const checks = version ? (readRubric(version)?.checks ?? []) : [];
  return { ...EMPTY_DRAFT, critical: Object.fromEntries(checks.map((key) => [key, ""])) };
}
function selectVersion(state: State, next: RubricVersion) {
  state.setVersion(next);
  state.setDraft((previous) => ({ ...previous, critical: blankDraft(next).critical }));
}
function freezeDraft(state: State, token: { revision: number; context: string }) {
  if (state.version)
    state.setReviewed({
      ...token,
      body: evaluationBody(state.draft, state.version.id, crypto.randomUUID()),
    });
}
function clearDraft(state: State) {
  state.setDraft(blankDraft(state.version));
  state.setSubmitted(false);
  state.setReviewed(null);
}
function draftActions(state: State) {
  return {
    select: (next: RubricVersion) => {
      selectVersion(state, next);
    },
    change: (name: keyof EvaluationDraft, value: string) => {
      state.setDraft((previous) => ({ ...previous, [name]: value }));
    },
    answer: (key: string, value: string) => {
      state.setDraft((previous) => ({
        ...previous,
        critical: { ...previous.critical, [key]: value },
      }));
    },
    freeze: (token: { revision: number; context: string }) => {
      freezeDraft(state, token);
    },
    clear: () => {
      clearDraft(state);
    },
  };
}
/** Raw observations live above replaceable reads and never enter browser storage. */
export function useEvaluationDraft() {
  const [draft, setDraft] = useState<EvaluationDraft>(EMPTY_DRAFT);
  const [version, setVersion] = useState<RubricVersion | null>(null);
  const [reviewed, setReviewed] = useState<Reviewed | null>(null);
  const [isSubmitted, setSubmitted] = useState(false);
  return {
    draft,
    version,
    reviewed,
    isSubmitted,
    setSubmitted,
    ...draftActions({ draft, version, setDraft, setVersion, setReviewed, setSubmitted }),
  };
}
