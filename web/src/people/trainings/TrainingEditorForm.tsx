import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { TrainingFields } from "./TrainingFields";
import { TrainingFormErrors } from "./TrainingFormErrors";
import { TrainingFeedback } from "./TrainingFeedback";
import { TrainingEditorActions } from "./TrainingEditorActions";
import { TrainingActiveField } from "./TrainingActiveField";
import type { MessageKey } from "@wolbachia/i18n";
import type { TrainingField } from "./training-fields";
import type { useTrainingEditor } from "./use-training-editor";
import styles from "./trainings.module.css";
import type { ReactNode } from "react";
interface Props {
  editor: ReturnType<typeof useTrainingEditor>;
  fields: readonly TrainingField[];
  title: MessageKey;
  hasActive?: boolean | undefined;
  before?: ReactNode;
}
export function TrainingEditorForm({ editor, fields, title, hasActive, before }: Props) {
  const { t } = useTranslation();
  if (editor.command.isDenied)
    return <InlineNotice tone="warning">{t("trainings.course.unavailable")}</InlineNotice>;
  return (
    <form
      noValidate
      className={styles.stack}
      onSubmit={(event) => {
        event.preventDefault();
        void editor.submit();
      }}
    >
      {before}
      <TrainingFormErrors fields={fields} {...editor.draft} />
      <TrainingFields fields={fields} {...editor.draft} />
      {hasActive && <TrainingActiveField draft={editor.draft} />}
      <TrainingFeedback {...editor.command} />
      <TrainingEditorActions editor={editor} title={title} />
    </form>
  );
}
