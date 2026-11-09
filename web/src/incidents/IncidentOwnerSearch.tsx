import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import type { IncidentReassignment } from "./use-incident-reassign";

export function IncidentOwnerSearch({ controller }: { controller: IncidentReassignment }) {
  const { t } = useTranslation();
  return (
    <TextField
      id="incident-owner-search"
      label={t("incidents.workspace.ownerSearch")}
      value={controller.capture.search}
      onChange={(event) => {
        controller.searchOwners(event.target.value);
      }}
    />
  );
}
