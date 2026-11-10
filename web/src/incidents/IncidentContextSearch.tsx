import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";

interface ContextSearchProps {
  search: string;
  onSearch: (value: string) => void;
}

export function IncidentContextSearch({ search, onSearch }: ContextSearchProps) {
  const { t } = useTranslation();
  return (
    <TextField
      id="incident-context-search"
      label={t("incidents.workspace.contextSearch")}
      value={search}
      onChange={(event) => {
        onSearch(event.target.value);
      }}
    />
  );
}
