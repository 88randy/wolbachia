import type { ScopeDimensionChange } from "./scope-types";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
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
  return (
    <>
      <label htmlFor={id}>{t("orgAdmin.scope.mode")}</label>
      <select
        id={id}
        value={value.mode}
        onChange={(event) => {
          const mode = event.target.value as Schemas["ModeEnum"];
          onChange((current) => ({ mode, ids: mode === "selected" ? current.ids : [] }));
        }}
      >
        <option value="none">{t("orgAdmin.scope.none")}</option>
        <option value="selected" disabled={allowed.mode === "none"}>
          {t("orgAdmin.scope.selected")}
        </option>
        {allowed.mode === "all" && <option value="all">{t("orgAdmin.scope.all")}</option>}
        {allowed.mode !== "all" && value.mode === "all" && (
          <option value="all" disabled>
            {t("orgAdmin.scope.all")}
          </option>
        )}
      </select>
    </>
  );
}
