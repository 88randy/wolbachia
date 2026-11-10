import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/DialogFooter";
import type { MessageKey } from "@wolbachia/i18n";
import type { useTrainingEditor } from "./use-training-editor";
import { useLayoutEffect, useRef } from "react";
interface Props {
  editor: ReturnType<typeof useTrainingEditor>;
  title: MessageKey;
}
export function TrainingEditorActions({ editor, title }: Props) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <DialogFooter>
      <Button
        ref={cancelRef}
        variant="secondary"
        onClick={() => {
          editor.onOpenChange(false);
        }}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button type="submit" loading={editor.command.isSaving} aria-disabled={editor.isBlocked}>
        {t(title)}
      </Button>
    </DialogFooter>
  );
}
