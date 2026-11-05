import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { usePointRelocation } from "./use-point-relocation";
import type { RelocationOptions } from "./use-point-relocation";
import { RelocationFeedback } from "./RelocationFeedback";
import { RelocationControls } from "./RelocationControls";
export function PointRelocationForm(options: RelocationOptions) {
  const { t } = useTranslation();
  const id = useId();
  const form = usePointRelocation(options);
  const field = {
    id,
    label: t("geography.field.location"),
    value: form.text,
    disabled: form.write.isBusy,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      form.setText(event.target.value);
    },
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.send();
      }}
    >
      <TextField {...field} />
      <RelocationControls form={form} />
      <RelocationFeedback form={form} />
    </form>
  );
}
