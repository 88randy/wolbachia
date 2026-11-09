import type { SubmitEvent } from "react";
import { useIncidentDraft } from "./use-incident-draft";
import type { IncidentActionProps } from "./IncidentComment";
const COMMENT_MAX_LENGTH = 4000;
/** Keeps the comment capture and clears it only after a confirmed save. */
export function useIncidentComment(props: IncidentActionProps) {
  const draft = useIncidentDraft("comment");
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!props.isBlocked && draft.value.trim())
      void props
        .submit({
          action: "comment",
          body: { expected_revision: props.incident.revision, text: draft.value.trim() },
        })
        .then((saved) => {
          if (saved) draft.setValue("");
        });
  };
  const field = {
    draft,
    id: "incident-comment",
    labelKey: "incidents.workspace.comment" as const,
    disabled: props.isBusy,
    maxLength: COMMENT_MAX_LENGTH,
  };
  return { field, onSubmit, isBlocked: props.isBlocked || !draft.value.trim() };
}
