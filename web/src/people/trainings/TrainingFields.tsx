import type { TrainingDraft } from "./training-input";
import type { TrainingField } from "./training-fields";
import { TrainingFieldControl } from "./TrainingFieldControl";
import styles from "./trainings.module.css";
interface Props {
  fields: readonly TrainingField[];
  draft: TrainingDraft;
  setField: (key: string, value: string) => void;
  hasSubmitted: boolean;
  fieldPrefix: string;
  isLocked?: boolean;
}
export function TrainingFields({ fields, ...props }: Props) {
  return (
    <div className={styles.fields}>
      {fields.map((field) => (
        <TrainingFieldControl key={field.key} field={field} {...props} />
      ))}
    </div>
  );
}
