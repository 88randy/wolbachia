import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { TextField } from "../../forms/TextField";
import type { RubricLookupModel } from "./use-rubric-lookup";
export function RubricLookupForm({ model }: { model: RubricLookupModel }) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        model.lookup();
      }}
    >
      <TextField
        id="evaluation-rubric-code"
        label={t("evaluations.rubric.code")}
        value={model.input}
        onChange={(event) => {
          model.setInput(event.target.value);
        }}
        required
        maxLength={64}
      />
      <Button type="submit">{t("evaluations.rubric.lookup")}</Button>
    </form>
  );
}
