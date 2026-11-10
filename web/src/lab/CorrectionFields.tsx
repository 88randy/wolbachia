import { useId } from "react";
import { CountInput } from "./CountInput";
import { CorrectionReasonCodeField } from "./CorrectionReasonCodeField";
import { CorrectionReasonNoteField } from "./CorrectionReasonNoteField";
import type { useCorrectionForm } from "./use-correction-form";
export function CorrectionFields({ form }: { form: ReturnType<typeof useCorrectionForm> }) {
  const id = useId();
  const isLocked = form.write.isBusy || form.write.failure?.kind === "uncertain";
  return (
    <>
      <CorrectionReasonCodeField id={id} form={form} isLocked={isLocked} />
      <CorrectionReasonNoteField id={id} form={form} isLocked={isLocked} />
      <CountInput
        onBlur={form.validateCount}
        value={form.value}
        onChange={form.setValue}
        inputRef={form.input}
        isInvalid={form.isInvalid}
        isReadOnly={isLocked}
        isReplacement
      />
    </>
  );
}
