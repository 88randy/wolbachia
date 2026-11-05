import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ResolutionDraft } from "./geometry";
interface Props {
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  canCreatePoint: boolean;
}
export function ResolutionDecision({ value, onChange, canCreatePoint }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{t("geography.field.decision")}</label>
      <select
        id={id}
        value={value.decision}
        onChange={(event) => {
          onChange({ ...value, decision: event.target.value as ResolutionDraft["decision"] });
        }}
      >
        <option value="">{t("geography.editor.emptyDecision")}</option>
        <option value="keep">{t("geography.editor.keep")}</option>
        {canCreatePoint && <option value="move">{t("geography.editor.move")}</option>}
        {canCreatePoint && <option value="remove">{t("geography.editor.remove")}</option>}
      </select>
    </>
  );
}
