import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";

export function AssignmentDateField({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      id="allocation-date"
      label={t("allocation.filter.date")}
      type="date"
      value={date}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
