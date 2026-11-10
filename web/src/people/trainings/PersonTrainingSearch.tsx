import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { useTrainingDraft } from "./use-training-draft";
import { TrainingFields } from "./TrainingFields";
import { TrainingFormErrors } from "./TrainingFormErrors";
import { CONTEXT_FIELDS } from "./training-fields";
import type { TrainingField } from "./training-fields";
import type { PersonContext } from "./person-context";
import styles from "./trainings.module.css";
const FIELDS: TrainingField[] = [
  { key: "subject", label: "trainings.field.subject", kind: "uuid" },
  ...CONTEXT_FIELDS,
  { key: "action", label: "trainings.field.action", isOptional: true },
  {
    key: "at",
    label: "trainings.field.at",
    kind: "instant",
    isOptional: true,
    hint: "trainings.field.instantHint",
  },
];
export function PersonTrainingSearch({ context }: { context: PersonContext }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useTrainingDraft({ ...context });
  function submit() {
    if (!draft.validate(FIELDS)) return;
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, ...draft.draft, person_page: "1" }),
    });
  }
  return (
    <form
      noValidate
      className={styles.stack}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TrainingFormErrors fields={FIELDS} {...draft} />
      <TrainingFields fields={FIELDS} {...draft} />
      <Button type="submit" variant="secondary">
        {t("trainings.person.inspect")}
      </Button>
    </form>
  );
}
