import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { IncidentTypeOption } from "./IncidentTypeOption.tsx";

export interface TypeOptionProps {
  readonly types: readonly Schemas["IncidentType"][];
  readonly selected: string | null;
  readonly query: string;
  readonly onQuery: (value: string) => void;
  readonly choose: (id: string) => void;
}
function matchingTypes(props: TypeOptionProps) {
  return props.types
    .filter((type) => type.label.toLocaleLowerCase().includes(props.query.toLocaleLowerCase()))
    .sort((left, right) => Number(left.is_other) - Number(right.is_other));
}
export function IncidentTypeOptions(props: TypeOptionProps) {
  const t = useT();
  const matches = matchingTypes(props);
  const emptyKey = props.types.length
    ? "mobile.incidents.noTypeMatches"
    : "mobile.incidents.noTypes";
  return (
    <View>
      <AppText>{t("mobile.incidents.searchTypes")}</AppText>
      <TextField
        label={t("mobile.incidents.searchTypes")}
        value={props.query}
        onChangeText={props.onQuery}
      />
      {matches.length ? (
        matches.map((type) => (
          <IncidentTypeOption
            key={type.current_version_id}
            type={type}
            isSelected={type.current_version_id === props.selected}
            choose={props.choose}
          />
        ))
      ) : (
        <AppText>{t(emptyKey)}</AppText>
      )}
    </View>
  );
}
