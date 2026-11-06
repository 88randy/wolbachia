import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { scopeModeLabel } from "./scope-labels";
export function ProfileScopeSummary({ scope }: { scope: Schemas["MeScope"] }) {
  const { t } = useTranslation();
  return (
    <dl>
      <dt>{t("orgAdmin.scope.centers")}</dt>
      <dd>{t(scopeModeLabel(scope.centers))}</dd>
      <dt>{t("orgAdmin.scope.quadrants")}</dt>
      <dd>{t(scopeModeLabel(scope.quadrants))}</dd>
    </dl>
  );
}
