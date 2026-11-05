import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { PolygonField } from "./PolygonField";
import type { CreateQuadrant } from "./use-create-quadrant";
import styles from "./geography.module.css";
export function QuadrantCreateFields({ form }: { form: CreateQuadrant }) {
  const { t } = useTranslation();
  const id = useId();
  const code = {
    id: id + "-code",
    label: t("geography.field.code"),
    value: form.code,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      form.setCode(event.target.value);
    },
    required: true,
  };
  const center = {
    id: id + "-center",
    label: t("geography.field.center"),
    value: form.center,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      form.setCenter(event.target.value);
    },
    required: true,
  };
  return (
    <fieldset disabled={form.write.isBusy} className={styles.fieldset}>
      <TextField {...code} />
      <TextField {...center} />
      <PolygonField value={form.text} onChange={form.setText} />
    </fieldset>
  );
}
