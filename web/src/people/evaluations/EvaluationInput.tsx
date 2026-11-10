import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { TextField } from "../../forms/TextField";
interface Props {
  name: string;
  labelKey: MessageKey;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
  isSubmitted: boolean;
  hint?: string;
  numeric?: boolean;
}
export function EvaluationInput(props: Props) {
  const { t } = useTranslation();
  const [isTouched, setTouched] = useState(false);
  return (
    <TextField
      id={`evaluation-${props.name}`}
      label={t(props.labelKey)}
      value={props.value}
      type={props.numeric ? "number" : "text"}
      {...(props.numeric ? { min: 0, max: 100, step: "0.0001" } : {})}
      maxLength={props.numeric ? undefined : 100}
      hint={props.hint}
      error={
        (props.isSubmitted || isTouched) && props.isInvalid
          ? t("evaluations.form.invalid")
          : undefined
      }
      onBlur={() => {
        setTouched(true);
      }}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
    />
  );
}
