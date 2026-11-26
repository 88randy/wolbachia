import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { TextField } from "../../forms/TextField";
import type { OrganizationFormController } from "./use-organization-form";
type Field = "name" | "country" | "timezone" | "label_phone" | "support_contact";
interface Definition {
  field: Field;
  key: MessageKey;
  max: number;
  isReadOnly?: boolean;
}
const FIELDS: Definition[] = [
  { field: "name", key: "orgAdmin.organization.name", max: 200 },
  { field: "country", key: "orgAdmin.organization.country", max: 2, isReadOnly: true },
  { field: "timezone", key: "orgAdmin.organization.timezone", max: 64 },
  { field: "label_phone", key: "orgAdmin.organization.phone", max: 40 },
  { field: "support_contact", key: "orgAdmin.organization.support", max: 200 },
];
export function OrganizationTextFields({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  return (
    <>
      {FIELDS.map(({ field, key, max, isReadOnly }) => (
        <TextField
          key={field}
          id={`organization-${field}`}
          label={t(key)}
          hint={isReadOnly ? t("orgAdmin.organization.countryReadOnly") : undefined}
          value={controller.settings[field]}
          required={field === "name" || field === "timezone"}
          maxLength={max}
          readOnly={isReadOnly}
          onChange={(event) => {
            controller.change(field, event.target.value);
          }}
        />
      ))}
    </>
  );
}
