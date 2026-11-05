import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../data-table/table-error";
import type { CenterSelectorController } from "./use-center-selector";
export function CenterState({ selector }: { selector: CenterSelectorController }) {
  const { t } = useTranslation();
  if (selector.query.isError)
    return <span role="alert">{t(tableErrorKey(selector.query.error))}</span>;
  if (selector.query.isPending) return <span role="status">{t("states.loading.label")}</span>;
  if (selector.centers.length === 0) return <span role="status">{t("orgAdmin.center.empty")}</span>;
  return null;
}
