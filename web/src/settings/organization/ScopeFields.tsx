import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { ScopeDimensionField } from "./ScopeDimensionField";
interface Props {
  scope: Schemas["MeScope"];
  onChange: (scope: Schemas["MeScope"]) => void;
}
export function ScopeFields({ scope, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("orgAdmin.scope.hint")}</p>
      <ScopeDimensionField
        dimension="centers"
        value={scope.centers}
        onChange={(centers) => {
          onChange({ ...scope, centers });
        }}
      />
      <ScopeDimensionField
        dimension="quadrants"
        value={scope.quadrants}
        onChange={(quadrants) => {
          onChange({ ...scope, quadrants });
        }}
      />
    </>
  );
}
