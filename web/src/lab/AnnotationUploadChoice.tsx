import { useTranslation } from "react-i18next";
import { spacing } from "@wolbachia/tokens";
import { Button } from "../ui/Button";
import { isAnnotationPhoto } from "./annotation-upload";
import { useBlobUrl } from "./use-blob-url";
import styles from "./annotation-upload.module.css";
interface Props {
  selected?: { file: File; clientId: string };
  isBusy: boolean;
  isAllowed: boolean;
  hasFailed: boolean;
  onChoose: (file: File, clientId: string) => void;
}
export function AnnotationUploadChoice(props: Props) {
  const { selected, isBusy, isAllowed, hasFailed, onChoose } = props;
  const { t } = useTranslation();
  const url = useBlobUrl(selected?.file);
  if (!selected) return null;
  return (
    <div className={styles.preview}>
      {url && (
        <img
          src={url}
          alt={t("labAnnotation.upload.preview")}
          width={spacing[6] * 2}
          height={spacing[6] * 2}
        />
      )}
      <p>{selected.file.name}</p>
      {hasFailed && (
        <Button
          loading={isBusy}
          aria-disabled={!isAllowed || !isAnnotationPhoto(selected.file)}
          onClick={() => {
            onChoose(selected.file, selected.clientId);
          }}
        >
          {t("common.actions.retry")}
        </Button>
      )}
    </div>
  );
}
