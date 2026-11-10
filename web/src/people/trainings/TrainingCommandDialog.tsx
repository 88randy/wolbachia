import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { MessageKey } from "@wolbachia/i18n";
import { useTrainingEditor } from "./use-training-editor";
import type { TrainingEditorOptions } from "./use-training-editor";
import { TrainingEditorForm } from "./TrainingEditorForm";
import type { ReactNode } from "react";
interface Props extends TrainingEditorOptions {
  title: MessageKey;
  description: MessageKey;
  hasActive?: boolean;
  triggerVariant?: "primary" | "secondary";
  renderBefore?: (editor: ReturnType<typeof useTrainingEditor>) => ReactNode;
}
export function TrainingCommandDialog(props: Props) {
  const { t } = useTranslation();
  const editor = useTrainingEditor(props);
  return (
    <Dialog
      open={editor.isOpen}
      onOpenChange={editor.onOpenChange}
      title={t(props.title)}
      description={t(props.description)}
      trigger={
        <Button variant={props.triggerVariant ?? "secondary"} aria-disabled={props.isBlocked}>
          {t(props.title)}
        </Button>
      }
    >
      <TrainingEditorForm
        editor={editor}
        fields={props.fields}
        title={props.title}
        hasActive={props.hasActive}
        before={props.renderBefore?.(editor)}
      />
    </Dialog>
  );
}
