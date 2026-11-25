import { useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { AnnotationHelpDialog } from "./AnnotationHelpDialog";
import styles from "./annotation-settings.module.css";

export function AnnotationSettingsGuide({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <footer className={styles.footer}>
      <Button
        ref={trigger}
        variant="secondary"
        leadingIcon={<BookOpen aria-hidden="true" />}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t("labAnnotation.editor.guide")}
      </Button>
      {isOpen && (
        <AnnotationHelpDialog
          userId={userId}
          open
          onOpenChange={setOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      )}
    </footer>
  );
}
