import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { CountInput } from "./CountInput";
import { CountFeedback } from "./CountFeedback";
import { CountFormActions } from "./CountFormActions";
import type { useCountForm } from "./use-count-form";
import type { LabScope } from "./lab-query";

interface CountFormFieldsProps {
  form: ReturnType<typeof useCountForm>;
  scope: LabScope;
  code: string;
  isLocked: boolean;
}

export function CountFormFields({ form, scope, code, isLocked }: CountFormFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      {form.isRestored && (
        <p>
          {t("lab.draft.restored")}{" "}
          <Button variant="ghost" aria-disabled={isLocked} onClick={form.discard}>
            {t("lab.draft.discard")}
          </Button>
        </p>
      )}
      <CountInput
        onBlur={form.validate}
        value={form.value}
        onChange={form.change}
        inputRef={form.input}
        isInvalid={form.isInvalid}
        isReadOnly={isLocked || form.write.failure?.kind === "conflict"}
      />
      <CountFeedback failure={form.write.failure} scope={scope} code={code} />
      <CountFormActions form={form} />
    </>
  );
}
