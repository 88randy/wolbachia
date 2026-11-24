import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountDraftNotice } from "./CountDraftNotice";
import { AnnotationCountLink } from "./AnnotationCountLink";
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
      <CountDraftNotice form={form} isLocked={isLocked} />
      <CountInput
        onBlur={form.validate}
        value={form.value}
        onChange={form.change}
        inputRef={form.input}
        isInvalid={form.isInvalid}
        isReadOnly={isLocked || form.write.failure?.kind === "conflict"}
      />
      <AnnotationCountLink code={code} isLocked={isLocked} />
      <p className="m-0 flex items-center gap-1.5 text-xs text-ink-3">
        <Info aria-hidden="true" className="size-3.5 flex-none" />
        {t("lab.count.hint")}
      </p>
      <CountFeedback failure={form.write.failure} scope={scope} code={code} />
      <CountFormActions form={form} />
    </>
  );
}
