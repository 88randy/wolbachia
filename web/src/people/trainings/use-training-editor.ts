import { useEffect, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { TrainingDraft } from "./training-input";
import type { TrainingField } from "./training-fields";
import { useTrainingDraft } from "./use-training-draft";
import { useTrainingCommand } from "./use-training-command";
import type { TrainingScope } from "./training-query";
export interface TrainingEditorOptions {
  scope: TrainingScope;
  fields: readonly TrainingField[];
  initial?: TrainingDraft;
  execute: (draft: TrainingDraft, signal: AbortSignal) => Promise<Schemas["PeopleReceipt"]>;
  isBlocked?: boolean;
  onOpen?: () => void;
}
/** One RAM owner per command dialog, with guarded explicit submission and retained failed fields. */
export function useTrainingEditor(options: TrainingEditorOptions) {
  const [isOpen, setOpen] = useState(false);
  const draft = useTrainingDraft(options.initial);
  const command = useTrainingCommand(options.scope);
  const retire = draft.retire;
  useEffect(() => {
    if (command.isDenied) retire();
  }, [command.isDenied, retire]);
  const isBlocked =
    options.isBlocked === true || command.requiresReview || command.receipt !== undefined;
  function onOpenChange(open: boolean) {
    setOpen(open);
    if (open) options.onOpen?.();
  }
  async function submit() {
    if (isBlocked || !draft.validate(options.fields)) return;
    await command.send(async (signal) => options.execute(draft.draft, signal));
  }
  const ownedDraft = {
    ...draft,
    isLocked: command.isSaving || Boolean(command.receipt) || command.requiresReview,
  };
  return { draft: ownedDraft, command, isOpen, onOpenChange, submit, isBlocked };
}
