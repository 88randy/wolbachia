import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { AnnotationShortcutTable } from "./AnnotationShortcutTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}
export function AnnotationShortcutsDialog(props: Props) {
  const { t } = useTranslation();
  return (
    <Dialog
      trigger={null}
      title={t("labAnnotation.shortcuts.title")}
      description={t("labAnnotation.shortcuts.description")}
      open={props.open}
      onOpenChange={props.onOpenChange}
      onCloseAutoFocus={props.onCloseAutoFocus}
    >
      <AnnotationShortcutTable />
      <Button
        variant="secondary"
        onClick={() => {
          props.onOpenChange(false);
        }}
      >
        {t("common.actions.close")}
      </Button>
    </Dialog>
  );
}
