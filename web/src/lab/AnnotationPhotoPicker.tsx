import { useId } from "react";
import { useTranslation } from "react-i18next";
export function AnnotationPhotoPicker({
  isBusy,
  onChoose,
}: {
  isBusy: boolean;
  onChoose: (file?: File) => void;
}) {
  const id = useId();
  const { t } = useTranslation();
  return (
    <>
      <p id={id + "-help"}>{t("labAnnotation.upload.hint")}</p>
      <label htmlFor={id}>{t("labAnnotation.upload.picker")}</label>
      <input
        id={id}
        name="egg-photo"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={isBusy}
        aria-describedby={id + "-help"}
        onChange={(event) => {
          onChoose(event.target.files?.[0]);
        }}
      />
    </>
  );
}
