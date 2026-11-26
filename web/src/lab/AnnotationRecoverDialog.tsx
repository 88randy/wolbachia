import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { DialogFooter } from "../ui/DialogFooter";
import { Button } from "../ui/Button";

interface RecoveryProps {
  onRecover: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

export function AnnotationRecoverDialog(props: RecoveryProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      title={t("labAnnotation.recover.title")}
      description={t("labAnnotation.recover.description")}
      trigger={null}
      open
      onOpenChange={(open) => {
        if (!open) props.onDismiss();
      }}
    >
      <DialogFooter>
        <Button variant="secondary" onClick={props.onDiscard}>
          {t("labAnnotation.recover.discard")}
        </Button>
        <Button onClick={props.onRecover}>{t("labAnnotation.recover.accept")}</Button>
      </DialogFooter>
    </Dialog>
  );
}
