import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { PolygonField } from "./PolygonField";
import type { CreateBlock } from "./use-create-block";
import styles from "./geography.module.css";
export function BlockCreateFields({ form }: { form: CreateBlock }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <fieldset disabled={form.write.isBusy || form.saved !== null} className={styles.fieldset}>
      <TextField
        id={id}
        label={t("geography.blocks.code")}
        value={form.code}
        required
        onChange={(event) => {
          form.setCode(event.target.value);
        }}
      />
      <PolygonField value={form.text} onChange={form.setText} />
    </fieldset>
  );
}
