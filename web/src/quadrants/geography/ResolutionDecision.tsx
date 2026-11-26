import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import type { ResolutionDraft } from "./geometry";
interface Props {
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  canCreatePoint: boolean;
}
export function ResolutionDecision({ value, onChange, canCreatePoint }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const options = [
    { value: "", label: t("geography.editor.emptyDecision") },
    { value: "keep", label: t("geography.editor.keep") },
    ...(canCreatePoint
      ? [
          { value: "move", label: t("geography.editor.move") },
          { value: "remove", label: t("geography.editor.remove") },
        ]
      : []),
  ];
  return (
    <Select
      id={id}
      label={t("geography.field.decision")}
      value={value.decision}
      options={options}
      onChange={(event) => {
        onChange({ ...value, decision: event.target.value as ResolutionDraft["decision"] });
      }}
    />
  );
}
