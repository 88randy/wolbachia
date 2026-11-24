import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { AnnotationTipsStepActions } from "./AnnotationTipsStepActions";
import type { useAnnotationHelp } from "./use-annotation-help";
import styles from "./annotation-help.module.css";

type Props = { guide: ReturnType<typeof useAnnotationHelp> };
export function AnnotationTipsNavigation({ guide }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.navigation}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          guide.changeOpen(false);
        }}
      >
        {t("labAnnotation.tips.skip")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        ref={guide.shortcutsTrigger}
        onClick={() => {
          guide.setShortcutsOpen(true);
        }}
      >
        {t("labAnnotation.tips.shortcuts")}
      </Button>
      <AnnotationTipsStepActions guide={guide} />
    </div>
  );
}
