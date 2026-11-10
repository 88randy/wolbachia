import { useTranslation } from "react-i18next";
import { SearchField } from "../../forms/SearchField";
import type { TypeScope } from "./incident-types-query";
import type { OwnerFieldProps } from "./owner-field-types";
import { useOwnerField } from "./use-owner-field";
import { TypeOwnerChoices } from "./TypeOwnerChoices";
import { TypeOwnerPaging } from "./TypeOwnerPaging";
/** Discovery is paged; current selected eligibility uses an independent exact UUID read. */
export function TypeOwnerField(props: OwnerFieldProps & { scope: TypeScope }) {
  const { t } = useTranslation();
  const controller = useOwnerField(props);
  const search = {
    id: `type-${props.name}-search`,
    label: t("incidentTypes.owner.search"),
    value: controller.search,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      controller.searchChanged(event.target.value);
    },
  };
  return (
    <fieldset>
      <legend>{props.label}</legend>
      <SearchField {...search} />
      <TypeOwnerChoices {...props} controller={controller} />
      <TypeOwnerPaging controller={controller} />
      {props.value && !controller.eligible && <p>{t("incidentTypes.owner.unavailable")}</p>}
    </fieldset>
  );
}
