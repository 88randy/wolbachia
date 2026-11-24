import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useAnnotationHelp } from "./use-annotation-help";

interface HelpProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnnotationHelpDialog({ userId, open, onOpenChange }: HelpProps) {
  const { t } = useTranslation();
  const { isFirstUse, changeOpen } = useAnnotationHelp(userId, onOpenChange);
  return (
    <Dialog
      title={t("labAnnotation.tips.title")}
      description={t("labAnnotation.tips.description")}
      open={open || isFirstUse}
      onOpenChange={changeOpen}
      trigger={<Button variant="ghost">{t("labAnnotation.editor.help")}</Button>}
    >
      <ul>
        <li>{t("labAnnotation.tips.eggs")}</li>
        <li>{t("labAnnotation.tips.exclude")}</li>
        <li>{t("labAnnotation.tips.sweep")}</li>
      </ul>
      <p>{t("labAnnotation.editor.shortcuts")}</p>
      <Button
        onClick={() => {
          changeOpen(false);
        }}
      >
        {t("labAnnotation.tips.close")}
      </Button>
    </Dialog>
  );
}
