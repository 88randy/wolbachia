import type { ScopeDimensionChange } from "./scope-types";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Select } from "../../forms/Select";
import { useMe } from "../../session/use-me";
interface Props {
  id: string;
  dimension: "centers" | "quadrants";
  value: Schemas["ScopeDimension"];
  onChange: ScopeDimensionChange;
}
export function ScopeModeSelect({ id, dimension, value, onChange }: Props) {
  const { t } = useTranslation();
  const allowed = useMe().scope[dimension];
  const options = [
    { value: "none", label: t("orgAdmin.scope.none") },
    ...(allowed.mode === "none"
      ? []
      : [{ value: "selected", label: t("orgAdmin.scope.selected") }]),
    ...(allowed.mode === "all" || value.mode === "all"
      ? [{ value: "all", label: t("orgAdmin.scope.all") }]
      : []),
  ];
  return (
    <Select
      id={id}
      label={t("orgAdmin.scope.mode")}
      value={value.mode}
      options={options}
      onChange={(event) => {
        const mode = event.target.value as Schemas["ModeEnum"];
        onChange((current) => ({ mode, ids: mode === "selected" ? current.ids : [] }));
      }}
    />
  );
}
