import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { useTrainingDraft } from "./use-training-draft";
import { TrainingFields } from "./TrainingFields";
import { TrainingFormErrors } from "./TrainingFormErrors";
import { CONTEXT_FIELDS } from "./training-fields";
import type { PersonContext } from "./person-context";
import styles from "./trainings.module.css";
export function TrainingContextSearch({ context }: { context: PersonContext }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useTrainingDraft({ center: context.center, quadrant: context.quadrant });
  function submit() {
    if (!draft.validate(CONTEXT_FIELDS)) return;
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, ...draft.draft, requirement_page: "1" }),
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
      <TrainingFormErrors fields={CONTEXT_FIELDS} {...draft} />
      <TrainingFields fields={CONTEXT_FIELDS} {...draft} />
      <Button type="submit" variant="secondary">
        {t("trainings.requirement.inspect")}
      </Button>
    </form>
  );
}
