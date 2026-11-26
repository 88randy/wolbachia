import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { AnnotationTipsContent } from "./AnnotationTipsContent";
import { AnnotationTipsNavigation } from "./AnnotationTipsNavigation";
import { AnnotationShortcutsDialog } from "./AnnotationShortcutsDialog";
import { useAnnotationHelp } from "./use-annotation-help";

interface HelpProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function AnnotationHelpDialog(props: HelpProps) {
  const { t } = useTranslation();
  const guide = useAnnotationHelp(props.userId, props.onOpenChange);
  return (
    <Dialog
      title={t("labAnnotation.tips.title")}
      description={t("labAnnotation.tips.description")}
      open={props.open || guide.isFirstUse}
      onOpenChange={guide.changeOpen}
      onCloseAutoFocus={props.onCloseAutoFocus}
      trigger={null}
    >
      <AnnotationTipsContent step={guide.step} />
      <AnnotationTipsNavigation guide={guide} />
      <AnnotationShortcutsDialog
        open={guide.shortcutsOpen}
        onOpenChange={guide.setShortcutsOpen}
        onCloseAutoFocus={guide.restoreShortcutsFocus}
      />
    </Dialog>
  );
}
