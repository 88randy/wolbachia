import { useTranslation } from "react-i18next";
import type { AnnotationCorrectionFieldProps } from "./AnnotationCorrectionFields";

type Props = Pick<AnnotationCorrectionFieldProps, "reason" | "isLocked" | "isInvalid"> & {
  id: string;
};

export function AnnotationCorrectionNoteField(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      <label htmlFor={props.id + "-note"}>{t("lab.correction.reason")}</label>
      <textarea
        id={props.id + "-note"}
        name="reason"
        value={props.reason[0]}
        required
        readOnly={props.isLocked}
        maxLength={1000}
        aria-invalid={props.isInvalid || undefined}
        aria-describedby={props.id + "-hint"}
        onChange={(event) => {
          props.reason[1](event.target.value);
        }}
      />
      <p id={props.id + "-hint"} role={props.isInvalid ? "alert" : undefined}>
        {t("lab.correction.noteHint")}
      </p>
    </>
  );
}
