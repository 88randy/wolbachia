import { useTranslation } from "react-i18next";
import { TypeOwnerField } from "./TypeOwnerField";
import { isConfiguredType } from "./incident-types-query";
import type { TypeTarget, TypeScope } from "./incident-types-query";
import type { TypeFormController } from "./use-type-form";
const FIELDS = [
  { name: "supervisor_id", key: "incidentTypes.field.supervisor", display: "supervisor_display" },
  {
    name: "coordinator_id",
    key: "incidentTypes.field.coordinator",
    display: "coordinator_display",
  },
  { name: "terminal_id", key: "incidentTypes.field.terminal", display: "terminal_display" },
] as const;
interface Props {
  scope: TypeScope;
  controller: TypeFormController;
  item?: TypeTarget;
}
export function TypeOwners({ scope, controller, item }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {FIELDS.map(({ name, key, display }) => (
        <TypeOwnerField
          key={name}
          name={name}
          scope={scope}
          label={t(key)}
          value={controller.draft[name] ?? ""}
          retainedLabel={isConfiguredType(item) ? item[display] : undefined}
          isTerminal={name === "terminal_id"}
          onChange={(value) => {
            controller.change(name, name !== "terminal_id" && value === "" ? null : value);
          }}
          onEligibility={(isEligible) => {
            controller.eligible(name, isEligible);
          }}
        />
      ))}
    </>
  );
}
