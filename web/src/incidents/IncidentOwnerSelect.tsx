import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { IncidentReassignment } from "./use-incident-reassign";

function ownerChoices(owners: { membership_id: string; label: string }[] = []) {
  return owners.map((item) => ({ value: item.membership_id, label: item.label }));
}
export function IncidentOwnerSelect({ controller }: { controller: IncidentReassignment }) {
  const { t } = useTranslation();
  const options = [
    { value: "", label: t("incidents.workspace.selectOwner") },
    ...ownerChoices(controller.query.data?.results),
  ];
  return (
    <Select
      id="incident-owner"
      label={t("incidents.workspace.owner")}
      value={controller.capture.owner}
      disabled={
        controller.query.isFetching ||
        controller.query.isPlaceholderData ||
        controller.query.isError
      }
      onChange={(event) => {
        controller.selectOwner(event.target.value);
      }}
      options={options}
    />
  );
}
