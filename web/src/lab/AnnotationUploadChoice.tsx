import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { isAnnotationPhoto } from "./annotation-upload";
interface Props {
  selected?: { file: File; clientId: string };
  isBusy: boolean;
  isAllowed: boolean;
  onChoose: (file: File, clientId: string) => void;
}
export function AnnotationUploadChoice({ selected, isBusy, isAllowed, onChoose }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {selected && <p>{selected.file.name}</p>}
      {selected && !isAnnotationPhoto(selected.file) && (
        <p role="alert">{t("labAnnotation.upload.invalid")}</p>
      )}
      <Button
        loading={isBusy}
        aria-disabled={!isAllowed || !selected || !isAnnotationPhoto(selected.file)}
        onClick={() => {
          if (selected) onChoose(selected.file, selected.clientId);
        }}
      >
        {t("labAnnotation.upload.start")}
      </Button>
    </>
  );
}
