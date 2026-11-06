import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { ValidatedTextField } from "../src/forms/ValidatedTextField";
import { Select } from "../src/forms/Select";
import { SearchField } from "../src/forms/SearchField";
import styles from "./PreviewComponents.module.css";
export function PreviewForms() {
  const { t } = useTranslation();
  return (
    <Card title={t("refresh.preview.forms")}>
      <div className={styles.stack}>
        <ValidatedTextField
          id="preview-ovitrap-code"
          label={t("refresh.preview.fieldLabel")}
          hint={t("refresh.preview.fieldHint")}
          defaultValue="OV-1284"
          validate={(value) =>
            value.trim().length < 3 ? t("refresh.preview.fieldError") : undefined
          }
        />
        <Select
          id="preview-center"
          label={t("refresh.preview.select")}
          options={[
            { value: "north", label: t("refresh.preview.centerName") },
            { value: "south", label: t("ui.preview.centerSouth") },
          ]}
        />
        <SearchField
          id="preview-search"
          label={t("refresh.preview.search")}
          placeholder={t("refresh.preview.fieldLabel")}
        />
      </div>
    </Card>
  );
}
