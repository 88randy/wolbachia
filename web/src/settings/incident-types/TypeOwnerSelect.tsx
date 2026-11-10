import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import type { OwnerChoice, OwnerFieldProps } from "./owner-field-types";
interface Props extends OwnerFieldProps {
  choices: OwnerChoice[];
  selected?: OwnerChoice;
  isLoading: boolean;
}
export function TypeOwnerSelect(props: Props) {
  const { t } = useTranslation();
  const eligible = props.choices.filter((owner) => !props.isTerminal || owner.is_terminal_eligible);
  const options = eligible.map((owner) => ({ value: owner.membership_id, label: owner.label }));
  if (props.value && !options.some((option) => option.value === props.value))
    options.unshift({
      value: props.value,
      label: props.selected?.label ?? props.retainedLabel ?? t("incidentTypes.owner.unavailable"),
    });
  options.unshift({
    value: "",
    label: t(props.isTerminal ? "incidentTypes.owner.choose" : "incidentTypes.owner.skip"),
  });
  return (
    <Select
      id={`type-${props.name}`}
      label={props.label}
      value={props.value}
      required={props.isTerminal}
      disabled={props.isLoading}
      options={options}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
    />
  );
}
